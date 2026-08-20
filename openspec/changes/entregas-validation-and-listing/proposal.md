## Why

Para robustecer la ingesta de archivos y soportar la navegación de entregas en el frontend (vista de detalle de examen y futura ficha de alumno), es necesario:
1. Validar estrictamente los tipos de archivos (imágenes JPG/PNG/WEBP y documentos PDF) y límites de tamaño (10MB configurable) ANTES de persistir el archivo en disco o crear registros en la base de datos, retornando un error HTTP 400 descriptivo ante cualquier violación.
2. Proveer endpoints de listado de entregas (`GET /api/v1/entregas?examenId=X` y `GET /api/v1/entregas?alumnoId=X`) con validación que exija al menos un parámetro de filtro para evitar volcados masivos accidentales de la tabla.
3. Asegurar la resolución uniforme de la ruta de almacenamiento (`uploads/`) tanto en entornos de desarrollo como en producción compilada.

## What Changes

- Reutilización de `SUPPORTED_SUBMISSION_MIME_TYPES` importada desde `AiService` en el controlador y servicio de entregas para validar el tipo MIME.
- Configuración de límites en `FileInterceptor` con `MAX_UPLOAD_SIZE_MB` (por defecto 10MB) y filtro de excepciones `MulterExceptionFilter` para garantizar que errores de tamaño de archivo devuelvan un HTTP 400 claro.
- Implementación de `GET /api/v1/entregas` con filtros `@Query('examenId')` y `@Query('alumnoId')`, rechazando con 400 si no se proporciona ningún criterio.
- Resolución normalizada del directorio de `uploads/` mediante `process.env.UPLOADS_DIR` y fallback a `join(process.cwd(), 'uploads')`.
- Actualización de suite de pruebas de integración `test-endpoints.js` y documentación en `EVALIA_BACKEND_REF.md`.

## Capabilities

### New Capabilities
- `submission-validation-and-listing`: Validación previa al almacenamiento de archivos de entregas y consulta filtrada de entregas por examen o alumno.

### Modified Capabilities
- `submissions-api`: Se añade soporte para listado filtrado de entregas y validación de tipos MIME y tamaño de carga con respuesta HTTP 400.

## Impact

- **Código Afectado**: `src/entregas/*`, `src/common/filters/*`, `src/main.ts`, `test-endpoints.js`, `EVALIA_BACKEND_REF.md`.
- **APIs**:
  - `POST /api/v1/entregas` (valida MIME y tamaño, rechazo 400).
  - `GET /api/v1/entregas?examenId=X` y `GET /api/v1/entregas?alumnoId=X` (nuevo endpoint de listado).
