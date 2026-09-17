## Why

Actualmente, no existe el backend para la plataforma EvalIA. Es necesario establecer la base tecnológica utilizando NestJS y Prisma ORM para permitir a los profesores automatizar la asistencia de corrección de exámenes manuscritos utilizando IA con alta disponibilidad y tolerancia a fallas.

## What Changes

- Creación del proyecto base en NestJS con su configuración y arquitectura inicial.
- Definición e implementación del modelo de datos relacional usando Prisma y SQLite para desarrollo y PostgreSQL para producción, incorporando la entidad Curso (con materia, año, división y año lectivo), vinculando el Profesor a sus Cursos, y los Cursos a sus Alumnos y Exámenes, además de los campos criteriosIA, esEvaluacionVisual, archivo y nivelConfianza.
- Implementación de un servicio de IA unificado que utilice la API de Gemini como proveedor principal y un fallback automático invisible hacia OpenRouter en caso de errores (como límite de cuota 429, timeouts, o caídas de servidor 500/503).
- Exposición de endpoints API REST para gestionar cursos, exámenes, registrar alumnos en cursos, procesar archivos de entregas y modificar/aprobar calificaciones finales.

## Capabilities

### New Capabilities
- `db-schema`: Estructuración y migración del modelo de datos jerárquico de EvalIA (Profesor, Curso, Alumno, Examen, Pregunta, Entrega, Corrección) usando Prisma ORM y SQLite/PostgreSQL, vinculando correctamente las entidades conforme a los wireframes.
- `ai-fallback-engine`: Motor de integración de IA con Gemini API y OpenRouter que retorna el texto detectado, sugerencias de puntaje, observaciones, y calcula el nivel de confianza de la corrección.
- `submissions-api`: Endpoints REST y máquina de estados para gestionar la creación de cursos, asociación de alumnos y exámenes, subida de archivos de entregas (archivo) y control del flujo de corrección (PENDIENTE -> PROCESANDO -> REQUIERE_REVISION / PENDIENTE_APROBACION -> PUBLICADO).

### Modified Capabilities

## Impact

- **Código Afectado**: Ninguno (es un proyecto nuevo).
- **APIs**: Definición de nuevas rutas API REST bajo `/api/v1`.
- **Dependencias**: Se incorporarán `@nestjs/cli`, `@prisma/client`, `prisma`, y SDKs/clientes de IA.
- **Sistemas**: Configuración de SQLite y variables de entorno para APIs de Gemini y OpenRouter.
