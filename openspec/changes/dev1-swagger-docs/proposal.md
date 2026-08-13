## Why

Se requiere documentar de manera interactiva la API REST del backend de EvalIA. Esto permitirá a los desarrolladores del frontend y a nosotros probar de forma directa, visual y en tiempo real el comportamiento de los endpoints (incluyendo autenticación con tokens JWT) sin necesidad de configurar colecciones externas en herramientas como Postman.

## What Changes

- **Integración de OpenAPI**: Instalación y configuración de la especificación de Swagger utilizando `@nestjs/swagger` y `swagger-ui-express`.
- **Ruta de Documentación**: Exposición de la página web interactiva de Swagger bajo la ruta `/api/docs` en el inicio del backend.
- **Decoración de Controladores y Endpoints**: Incorporación de anotaciones y metadatos Swagger en los controladores existentes de Autenticación, Cursos y Entregas para detallar las peticiones, respuestas y la necesidad de tokens JWT en las rutas privadas.

## Capabilities

### New Capabilities
- `api-documentation`: Interfaz web interactiva generada por Swagger que documenta detalladamente todos los recursos, métodos HTTP, requerimientos de headers y payloads de la API de EvalIA.

## Impact

- **Código Afectado**:
  - `package.json` (nuevas dependencias `@nestjs/swagger` y `swagger-ui-express`).
  - `src/main.ts` (inicialización del módulo de Swagger).
  - `src/auth/auth.controller.ts` (anotaciones Swagger).
  - `src/cursos/cursos.controller.ts` (anotaciones Swagger y protección JWT).
  - `src/entregas/entregas.controller.ts` (anotaciones Swagger).
- **APIs**: Exposición de la ruta GET `/api/docs`.
