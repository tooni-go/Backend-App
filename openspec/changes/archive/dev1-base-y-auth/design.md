## Context

Se requiere estructurar la base de datos local mediante Prisma y configurar un flujo de autenticación seguro en NestJS basado en Google OAuth (para autenticación inicial) y JSON Web Tokens (JWT) para la autorización y mantenimiento del estado de la sesión en subsecuentes llamadas a la API de EvalIA.

## Goals / Non-Goals

**Goals:**
- Configurar y aplicar las migraciones iniciales de Prisma con SQLite local.
- Crear un script de semilla (`prisma/seed.ts`) que genere un profesor, cursos, alumnos, exámenes y preguntas iniciales para las pruebas.
- Implementar validación de Google ID Token en el backend utilizando `google-auth-library`.
- Firmar y validar un token JWT de sesión propio para EvalIA.
- Proteger las rutas sensibles de la API mediante un guard.

**Non-Goals:**
- Implementar autenticación por email y contraseña clásica (solo Google OAuth).
- Crear pantallas de registro en el backend (el registro se realiza de manera implícita al iniciar sesión por primera vez si el profesor no existe en la base de datos).

## Decisions

### Decisión 1: Estrategia de Autenticación Híbrida (Google OAuth + JWT)
- **Decisión**: El flujo de autenticación funcionará de la siguiente manera:
  1. El frontend obtiene el `idToken` de Google mediante su flujo OAuth.
  2. Envía este token al backend NestJS vía `POST /api/v1/auth/login`.
  3. El backend verifica el token usando `google-auth-library` contra los servidores de Google.
  4. Si es válido y el profesor no existe, se crea un registro en la base de datos automáticamente usando los datos del perfil de Google (nombre, apellido, email, googleId).
  5. Se emite un JWT firmado por el backend de EvalIA con el ID del profesor (`id`) y su email en el payload.
  6. Para peticiones subsecuentes, el frontend envía el JWT en la cabecera `Authorization: Bearer <token>`.
- **Razón**: Evita tener que verificar el token de Google contra sus APIs en cada petición del usuario, lo que mejorará drásticamente la latencia y robustez de la API de EvalIA, además de desacoplar la sesión interna del ciclo de vida de Google.

```
┌──────────┐              ┌─────────┐              ┌──────────────────────┐
│  Client  │              │ Backend │              │ Google Auth Services │
│ (NextJS) │              │(NestJS) │              │       (API)          │
└────┬─────┘              └────┬────┘              └──────────┬───────────┘
     │                         │                              │
     │ 1. Inicia sesión        │                              │
     │    con Google           │                              │
     ├─────────────────────────┼─────────────────────────────>│
     │                         │                              │
     │ 2. Retorna ID Token     │                              │
     │<────────────────────────┼──────────────────────────────┤
     │                         │                              │
     │ 3. POST /auth/login     │                              │
     │    { token: "ID_TOKEN" }│                              │
     ├────────────────────────>│                              │
     │                         │ 4. Valida ID Token           │
     │                         ├─────────────────────────────>│
     │                         │                              │
     │                         │ 5. Retorna perfil del usuario│
     │                         │<─────────────────────────────┤
     │                         │                              │
     │                         │ 6. Busca/Crea Profesor       │
     │                         │    en la base de datos       │
     │                         │                              │
     │                         │ 7. Genera JWT interno        │
     │                         │                              │
     │ 8. Retorna JWT interno  │                              │
     │    { accessToken: "..." }│                             │
     │<────────────────────────┤                              │
     ▼                         ▼                              ▼
```

### Decisión 2: Estructura del Seed (`prisma/seed.ts`)
- **Decisión**: Para realizar pruebas rápidas y efectivas, el seed creará:
  - 1 Profesor por defecto: `default@evalia.com` (Google ID: `default-google-id`).
  - 1 Curso: "Matemática 5to A 2026".
  - 3 Alumnos asociados al curso.
  - 1 Examen: "Examen de Álgebra" con 2 preguntas (una de ellas con `esEvaluacionVisual = true` para probar la lógica de fallback/revisión).
- **Razón**: Esto asegura que todos los flujos de la API (desde subir una entrega hasta corregirla o aprobarla) se puedan ejecutar localmente sin depender de registros manuales en la base de datos en cada reinicio.

### Decisión 3: Migraciones Prisma
- **Decisión**: Usaremos la base de datos local SQLite configurada con LibSQL adapter. Correremos `npx prisma migrate dev` para asegurar que el esquema y las relaciones estén sincronizados localmente.
- **Razón**: La base de datos y esquema ya tienen migraciones iniciales generadas. `npx prisma migrate dev` aplicará cualquier migración pendiente o generará el cliente Prisma actualizado.

## Risks / Trade-offs

- **[Riesgo] Expiración del Token**: Si los tokens expiran muy rápido, afectará la UX; si expiran muy lento, hay riesgos de seguridad.
  - *Mitigación*: Configuraremos una expiración inicial de 7 días (`7d`) para facilitar las pruebas del MVP y evitar reconexiones constantes durante el desarrollo.
- **[Riesgo] Credenciales y Variables de Entorno**: El uso de Google OAuth requiere un `client_id` configurado en el backend.
  - *Mitigación*: Se agregará soporte de variables de entorno y se validará que `GOOGLE_CLIENT_ID` y `JWT_SECRET` estén presentes al iniciar la aplicación.
