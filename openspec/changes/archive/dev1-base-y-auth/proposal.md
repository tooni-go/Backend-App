## Why

Se requiere sentar las bases de la base de datos local y el sistema de autenticación de EvalIA utilizando Google OAuth y JWT interno. Esto asegurará la consistencia del modelo de datos con los requerimientos técnicos y restringirá de forma segura el acceso de los profesores a sus correspondientes cursos y entregas de exámenes.

## What Changes

- **Setup de Base de Datos**: Inicialización local de la base de datos SQLite (mediante LibSQL) utilizando Prisma ORM v7 y la aplicación de migraciones.
- **Datos de Semilla**: Creación de un script `prisma/seed.ts` para popular la base de datos local con datos de prueba estructurados (Profesor, Curso, Alumno, Examen y Preguntas) para facilitar las pruebas del backend y del frontend.
- **Autenticación NestJS**:
  - Instalación de dependencias de OAuth y JWT (`google-auth-library`, `@nestjs/jwt`, `passport-jwt`, `@types/passport-jwt`).
  - Creación del módulo `AuthModule` con un endpoint `POST /api/v1/auth/login` que valide el token ID de Google enviado por el cliente y devuelva un JWT interno firmado para la sesión.
  - Implementación de un `JwtAuthGuard` y `JwtStrategy` para proteger endpoints y extraer el perfil del docente (`req.user`).

## Capabilities

### New Capabilities
- `authentication`: Autenticación segura mediante Google OAuth en el backend NestJS, validando tokens de Google y generando un JWT local de sesión.
- `database-seed`: Script de poblamiento de datos (`npx prisma db seed`) para agilizar pruebas de desarrollo y desarrollo del frontend.

## Impact

- **Código Afectado**:
  - `package.json` (nuevas dependencias de autenticación y comando de semilla prisma).
  - `prisma/seed.ts` [NEW]
  - `src/auth/` [NEW] (módulo, controlador, servicio, estrategia y guard de JWT).
- **APIs**: Nuevo endpoint `POST /api/v1/auth/login`.
- **Configuraciones**: Nuevas variables de entorno requeridas (`GOOGLE_CLIENT_ID`, `JWT_SECRET`).
