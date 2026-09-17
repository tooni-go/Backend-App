## Context

Se requiere inicializar el backend para EvalIA, una plataforma web de asistencia inteligente para la corrección de exámenes manuscritos. El backend se construirá con NestJS, Prisma ORM, SQLite en desarrollo, y PostgreSQL en producción, y se integrará con las APIs de Gemini y OpenRouter.

## Goals / Non-Goals

**Goals:**
- Configurar el backend base en NestJS listo para producción.
- Definir y modelar la base de datos con Prisma ORM (SQLite para desarrollo local, PostgreSQL para producción).
- Implementar la máquina de estados de las entregas (`PENDIENTE`, `PROCESANDO`, `REQUIERE_REVISION`, `PENDIENTE_APROBACION`, `PUBLICADO`).
- Diseñar e implementar el motor de reintento/fallback de IA entre Gemini (principal) y OpenRouter (secundario).

**Non-Goals:**
- Crear interfaces de frontend o vistas en esta fase.
- Implementar autenticación compleja (Google OAuth será manejado por el frontend y el backend consumirá tokens).

## Decisions

### Decisión 1: Configuración de la Base de Datos y Prisma ORM
Decidimos utilizar Prisma ORM con SQLite para el desarrollo local y PostgreSQL para producción, estructurando las relaciones de forma jerárquica:
- **Profesor** -> Uno-a-Muchos -> **Curso** (Un profesor administra varios cursos).
- **Curso** -> Uno-a-Muchos -> **Examen** (Un examen pertenece a un único curso; se eliminan los campos planos de materia y curso en Examen).
- **Curso** -> Muchos-a-Muchos -> **Alumno** (Modelado implícito en Prisma, permitiendo que un alumno esté en múltiples cursos y un curso tenga múltiples alumnos).
- **Examen** -> Uno-a-Muchos -> **Pregunta** y **Entrega**.
- **Entrega** -> Uno-a-Muchos -> **Correccion**.
- **Razón**: SQLite permite un desarrollo local rápido. La estructura jerárquica con la entidad `Curso` es indispensable para reflejar de forma exacta el Dashboard y el Detalle del Curso especificados en los wireframes.
- **Alternativas consideradas**:
  - *Relación Plana (sin Curso)*: Se consideró inicialmente (del README.md original) pero se descartó porque impide la gestión de listas de alumnos por curso y agrupamiento de exámenes en el dashboard de forma dinámica.
  - *Usar PostgreSQL directamente en desarrollo*: Requiere mayor configuración de entorno local.

### Decisión 2: Flujo y Máquina de Estados de la Entrega
La entidad `Entrega` transita a través de los siguientes estados:
- `PENDIENTE`: Creada, esperando procesamiento del archivo de entrega (`archivo` que contiene imagen o PDF).
- `PROCESANDO`: Enviada al motor de IA para corrección.
- `REQUIERE_REVISION`: Se activa automáticamente si el nivel de confianza (`nivelConfianza`) devuelto por la IA es bajo, o si alguna pregunta del examen requiere evaluación visual/gráfica (`esEvaluacionVisual = true`), requiriendo validación y corrección manual por parte del docente.
- `PENDIENTE_APROBACION`: IA devolvió una sugerencia estructurada con nivel de confianza medio o alto, esperando que el profesor revise y apruebe.
- `PUBLICADO`: Calificación final y observaciones guardadas y aprobadas por el docente.
- **Razón**: Esto permite que el profesor intervenga específicamente en las entregas complejas o dudosas, optimizando su tiempo y manteniendo el control pedagógico.

### Decisión 3: Arquitectura del Mecanismo de Fallback de IA
El motor de IA se abstraerá bajo un servicio unificado en NestJS (ej. `AiEvaluationService`).
- Si la llamada al cliente de Gemini falla (Error 429 cuota excedida, error 500/503 caída, o timeout de 15 segundos):
  - El sistema captura la excepción.
  - Registra el error interno.
  - Reintenta de manera inmediata e invisible utilizando el cliente de OpenRouter (usando un modelo compatible como Claude 3.5 Sonnet o GPT-4o-mini).
- **Razón**: Esto asegura la resiliencia del sistema sin acoplar los endpoints a la disponibilidad de Gemini.
- **Alternativas consideradas**:
  - *Retornar error al usuario final y pedir reintento*: Mala experiencia de usuario.
  - *Ejecutar tareas en background asíncronas de cola*: Podría ser útil para cargas masivas, pero para el MVP se prefiere procesamiento directo con fallback síncrono rápido (con timeout).

## Risks / Trade-offs

- **[Riesgo] Migraciones entre SQLite y PostgreSQL**: SQLite no soporta todas las características de PostgreSQL (como Enums nativos).
  - *Mitigación*: En el esquema Prisma representaremos los estados como strings en SQLite y usaremos validación en NestJS, o usaremos la abstracción nativa de Prisma cuidando de no usar tipos de datos exclusivos de PostgreSQL.
- **[Riesgo] Costos en OpenRouter**: OpenRouter es un fallback de pago, mientras que Gemini puede usarse en capa gratuita.
  - *Mitigación*: Implementar límites de tamaño de archivo y logs detallados para monitorizar el uso del fallback.
