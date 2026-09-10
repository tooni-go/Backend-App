# Design: Entregas Validation and Listing

## Context
El sistema EvalIA requiere asegurar la integridad en la carga de archivos de entregas y ofrecer endpoints eficientes para que el frontend consulte las entregas agrupadas por examen o por alumno.

## Architecture & Decisions

### 1. Validación de Archivos (MIME y Tamaño)
- **MIME Types soportados:** Se reutiliza `SUPPORTED_SUBMISSION_MIME_TYPES` (`image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `application/pdf`).
- **Límite de tamaño:** Configurable vía variable de entorno `MAX_UPLOAD_SIZE_MB` con default de `10` MB.
- **Manejo de Errores Multer:** Se implementa un `MulterExceptionFilter` para interceptar códigos `LIMIT_FILE_SIZE` y transformar la respuesta en un `BadRequestException` (HTTP 400) con mensaje claro (`El archivo excede el tamaño máximo permitido de X MB.`), evitando respuestas 500 genéricas.
- **Validación previa:** Si el tipo MIME o el tamaño son inválidos, el archivo no se guarda en disco y no se genera ningún registro en la base de datos.

### 2. Endpoints de Listado de Entregas
- **Ruta:** `GET /api/v1/entregas`
- **Filtros admitidos:** `examenId` (string) y `alumnoId` (string).
- **Regla de negocio:** Si no se especifica al menos un parámetro de filtro, la API responde con `400 Bad Request` (`Debe especificar al menos un filtro: examenId o alumnoId.`) protegiendo la base de datos de lecturas masivas no acotadas.
- **Estructura de respuesta:** Lista de entregas con relaciones completas (`alumno`, `examen` con `preguntas`, y `correccion`).

### 3. Resolución de la Carpeta `uploads/`
- Se utiliza `process.env.UPLOADS_DIR || join(process.cwd(), 'uploads')` tanto en `main.ts` (al montar archivos estáticos en `/uploads/`) como en `EntregasService` (al escribir en disco), asegurando que en desarrollo (TS) y producción (build en dist) el directorio resuelto sea exactamente el mismo.
