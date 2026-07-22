## Why

Actualmente, no existe el backend para la plataforma EvalIA. Es necesario establecer la base tecnológica utilizando NestJS y Prisma ORM para permitir a los profesores automatizar la asistencia de corrección de exámenes manuscritos utilizando IA con alta disponibilidad y tolerancia a fallas.

## What Changes

- Creación del proyecto base en NestJS con su configuración y arquitectura inicial.
- Definición e implementación del modelo de datos relacional usando Prisma y SQLite para desarrollo y PostgreSQL para producción.
- Implementación de un servicio de IA unificado que utilice la API de Gemini como proveedor principal y un fallback automático invisible hacia OpenRouter en caso de errores (como límite de cuota 429, timeouts, o caídas de servidor 500/503).
- Exposición de endpoints API REST para gestionar exámenes, registrar alumnos, procesar archivos de entregas y modificar/aprobar calificaciones finales.

## Capabilities

### New Capabilities
- `db-schema`: Estructuración y migración del modelo de datos de EvalIA (Profesor, Alumno, Examen, Pregunta, Entrega, Corrección) usando Prisma ORM y SQLite/PostgreSQL.
- `ai-fallback-engine`: Motor de integración de IA con Gemini API que reenvía solicitudes a OpenRouter automáticamente si Gemini falla o excede cuotas.
- `submissions-api`: Endpoints REST y máquina de estados para subir archivos de entregas (imágenes y PDFs) y gestionar el flujo de corrección (PENDIENTE -> PROCESANDO -> REQUIERE_REVISION / PENDIENTE_APROBACION -> PUBLICADO) con intervención del profesor para validar la asistencia de la IA.

### Modified Capabilities

## Impact

- **Código Afectado**: Ninguno (es un proyecto nuevo).
- **APIs**: Definición de nuevas rutas API REST bajo `/api/v1`.
- **Dependencias**: Se incorporarán `@nestjs/cli`, `@prisma/client`, `prisma`, y SDKs/clientes de IA.
- **Sistemas**: Configuración de SQLite y variables de entorno para APIs de Gemini y OpenRouter.
