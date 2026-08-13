## 1. Inicialización y Setup Local

- [x] 1.1 Ejecutar `npm install` (Ya completado: dependencias del backend están listas).
- [x] 1.2 Ejecutar `npx prisma generate` para asegurar que el cliente de Prisma se genere correctamente a partir de la estructura en `prisma/schema.prisma`.

## 2. Base de Datos y Prisma (Semilla)

- [x] 2.1 Verificar el esquema de base de datos actual en `prisma/schema.prisma` y asegurar que coincida con los requerimientos (Profesor, Alumno, Examen, Pregunta, Entrega, Correccion, AlumnoCurso).
- [x] 2.2 Correr `npx prisma migrate dev` para aplicar migraciones iniciales a la base de datos local SQLite `dev.db`.
- [x] 2.3 Crear el archivo `prisma/seed.ts` para popular datos básicos de prueba (Profesor, Curso, Alumnos, Examen y Preguntas) utilizando el cliente de Prisma generado.
- [x] 2.4 Configurar el script de semilla en `package.json` agregando `"prisma": { "seed": "ts-node prisma/seed.ts" }` y ejecutar `npx prisma db seed`.

## 3. Autenticación NestJS

- [x] 3.1 Instalar dependencias de JWT y Google Auth: `npm install @nestjs/jwt passport-jwt google-auth-library` y `npm install --save-dev @types/passport-jwt`.
- [x] 3.2 Crear el módulo, servicio y controlador de autenticación (`AuthModule`, `AuthService`, `AuthController`).
- [x] 3.3 Implementar el endpoint `POST /api/v1/auth/login` que recibe el ID Token de Google, valida su firma con `google-auth-library`, obtiene el perfil del profesor, realiza un upsert del `Profesor` en la base de datos y retorna un JWT firmado por EvalIA.
- [x] 3.4 Configurar `JwtStrategy` y `JwtAuthGuard` en NestJS para validar el JWT y colocar la información del profesor en `req.user`.
- [x] 3.5 Actualizar `CursosService` para extraer el ID del profesor desde el usuario autenticado (`req.user`) en lugar de depender únicamente del header provisional o fallback por defecto.
