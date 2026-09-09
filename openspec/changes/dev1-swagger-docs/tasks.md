## 1. Instalación y Configuración Base

- [x] 1.1 Instalar dependencias de Swagger: `npm install @nestjs/swagger swagger-ui-express`.
- [x] 1.2 Configurar el inicializador de Swagger en `src/main.ts` registrando el título, descripción, versión y el esquema de seguridad global `Bearer JWT`.

## 2. Documentación de Endpoints

- [x] 2.1 Anotar `AuthController` documentando el endpoint `POST /api/v1/auth/login` con sus parámetros y respuestas típicas.
- [x] 2.2 Anotar `CursosController` documentando la creación, obtención de cursos, registro de alumnos y creación de exámenes. Asociar el esquema de seguridad JWT a este controlador.
- [x] 2.3 Anotar `EntregasController` documentando la subida de archivos, obtención de entregas y la aprobación del docente.

## 3. Verificación y Pruebas

- [x] 3.1 Levantar el backend en modo de desarrollo (`npm run start:dev`).
- [x] 3.2 Acceder a `http://localhost:3000/api/docs` y verificar que la interfaz de Swagger cargue correctamente.
- [x] 3.3 Validar interactivamente el login (obteniendo el token JWT) y autorizar la sesión en Swagger para comprobar el correcto funcionamiento de una petición al listado de cursos.
