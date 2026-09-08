## Context

Se requiere documentar de manera estándar y estructurada los endpoints expuestos por la API REST de EvalIA. Usaremos OpenAPI v3 a través de Swagger para proporcionar una interfaz de usuario interactiva y documentar el esquema de autenticación por Bearer JWT.

## Goals / Non-Goals

**Goals:**
- Configurar `@nestjs/swagger` y exponer la interfaz interactiva en `http://localhost:3000/api/docs`.
- Configurar el esquema de seguridad global `Bearer JWT` en Swagger.
- Documentar los controladores principales: `AuthController`, `CursosController` y `EntregasController`.
- Proporcionar ejemplos de payloads y descripciones de las respuestas esperadas.

**Non-Goals:**
- Configurar esquemas de documentación detallados para servicios auxiliares no expuestos en la API.
- Reemplazar las pruebas de integración Jest por pruebas en la UI de Swagger (la UI es para validación interactiva rápida y desarrollo del frontend).

## Decisions

### Decisión 1: Ruta de Exposición y Nombre del Recurso
- **Decisión**: Expondremos la interfaz interactiva en la URL `/api/docs`.
- **Razón**: Es una ruta estándar, limpia y fácil de recordar que no interfiere con los endpoints reales de la API (que están bajo `/api/v1/`).

### Decisión 2: Esquema de Autenticación Bearer JWT en Swagger
- **Decisión**: Configuraremos un esquema de autorización `JWT-auth` de tipo `http` con esquema `bearer` y formato `JWT`.
- **Razón**: Esto habilitará el botón global "Authorize" en la parte superior de la página de Swagger, lo que permite pegar el token JWT firmado de EvalIA una única vez y que todas las peticiones a endpoints decorados con `@ApiBearerAuth('JWT-auth')` incluyan la cabecera correspondiente de forma automática.

## Risks / Trade-offs

- **[Riesgo] Exposición de Documentación en Producción**: Si no se restringe, la documentación de Swagger podría quedar expuesta públicamente en el entorno de producción.
  - *Mitigación*: Por el momento, al estar en etapa de MVP y desarrollo local, la dejaremos activa. Para versiones futuras, se puede condicionar su inicialización evaluando `process.env.NODE_ENV !== 'production'`.
