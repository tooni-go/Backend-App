# Tasks

- [x] 1. Crear `MulterExceptionFilter` y registrarlo para transformar errores de Multer en respuestas HTTP 400 claras.
- [x] 2. Configurar límites de tamaño (`MAX_UPLOAD_SIZE_MB`) y reutilizar `SUPPORTED_SUBMISSION_MIME_TYPES` en `EntregasController` y `EntregasService`.
- [x] 3. Validar tipo MIME y tamaño de archivo ANTES de persistir a disco y base de datos.
- [x] 4. Implementar `GET /api/v1/entregas` con soporte para `@Query('examenId')` y `@Query('alumnoId')`, rechazando con 400 si no se envían filtros.
- [x] 5. Normalizar la resolución del directorio `uploads/` mediante `process.env.UPLOADS_DIR || join(process.cwd(), 'uploads')`.
- [x] 6. Actualizar `test-endpoints.js` con casos de prueba para tipo no soportado (400), tamaño excedido (400), listado filtrado por examen y alumno, y rechazo de listado sin filtros (400).
- [x] 7. Actualizar la especificación y documentación en `EVALIA_BACKEND_REF.md` y `.env.example`.
