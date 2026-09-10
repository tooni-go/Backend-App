# Tasks: Seguridad, Rotación de Secretos y Estandarización de Entornos (Tarea 4)

- [x] 1. **Estandarización de Variables en Backend (`.env.example`)**
  - [x] 1.1 Actualizar [.env.example](file:///c:/Users/valen/OneDrive/Desktop/BackPasantia/Backend-App/.env.example) agrupando las variables por secciones (`DATABASE_URL`, `PORT`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `UPLOADS_DIR`, `MAX_UPLOAD_SIZE_MB`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `AI_TIMEOUT_MS`).
  - [x] 1.2 Agregar comentarios descriptivos y valores por defecto seguros para cada variable.

- [x] 2. **Refuerzo de Reglas de Ignorado (`.gitignore` & `.dockerignore`)**
  - [x] 2.1 Actualizar [.gitignore](file:///c:/Users/valen/OneDrive/Desktop/BackPasantia/Backend-App/.gitignore) para ignorar `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production`.
  - [x] 2.2 Actualizar [.dockerignore](file:///c:/Users/valen/OneDrive/Desktop/BackPasantia/Backend-App/.dockerignore) con las mismas reglas para evitar incluir archivos de variables locales en imágenes Docker.

- [x] 3. **Implementación del Validador de Entorno al Inicio (`env.validator.ts`)**
  - [x] 3.1 Crear `src/common/config/env.validator.ts` con la función `validateEnvConfig()`.
  - [x] 3.2 Integrar `validateEnvConfig()` en el `bootstrap()` de `src/main.ts`.
  - [x] 3.3 Validar que el validador emita advertencias en dev y no rompa la ejecución de tests automáticos (`NODE_ENV=test`).

- [x] 4. **Documentación de Plantilla de Variables para Frontend**
  - [x] 4.1 Documentar en la propuesta/guía las variables frontend (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) para sincronizar con el equipo de frontend.

- [x] 5. **Verificación y Pruebas de Integración**
  - [x] 5.1 Ejecutar `npm run lint` para asegurar 0 errores de formateo o tipos.
  - [x] 5.2 Ejecutar `npm run build` para asegurar compilación limpia (Exit code 0).
  - [x] 5.3 Ejecutar `npm test` para asegurar que los tests unitarios pasen sin impedimentos.
