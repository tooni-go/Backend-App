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
Decidimos utilizar Prisma ORM con SQLite para el desarrollo local y PostgreSQL para producción.
- **Razón**: SQLite permite un desarrollo local rápido sin necesidad de dockerizar bases de datos pesadas. Prisma permite cambiar fácilmente el motor a PostgreSQL cambiando solo el proveedor en `schema.prisma` y la cadena de conexión.
- **Alternativas consideradas**:
  - *Usar PostgreSQL directamente en desarrollo*: Requiere más configuración de entorno local para los desarrolladores.
  - *Usar TypeORM*: Prisma ofrece mejor autocompletado y una sintaxis más declarativa para esquemas.

### Decisión 2: Flujo y Máquina de Estados de la Entrega
La entidad `Entrega` transita a través de los siguientes estados:
- `PENDIENTE`: Creada, esperando procesamiento de archivo (imagen o PDF).
- `PROCESANDO`: Enviada al motor de IA para corrección.
- `REQUIERE_REVISION`: Retornada de la IA pero marcada con baja confianza de legibilidad o datos incompletos. Requiere revisión manual forzosa.
- `PENDIENTE_APROBACION`: IA devolvió una sugerencia estructurada confiable, esperando que el profesor revise y apruebe.
- `PUBLICADO`: Calificación final y observaciones aprobadas por el docente y publicadas.
- **Razón**: Esta granularidad de estados permite una UI reactiva donde el profesor sabe exactamente qué entregas requieren atención inmediata.

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
