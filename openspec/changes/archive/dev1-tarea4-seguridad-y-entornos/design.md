# Design: Seguridad, Rotación de Secretos y Estandarización de Entornos (Tarea 4)

## Architecture Overview

El diseño aborda la gestión de configuración en tres niveles:
1. **Definición y Documentación**: Plantillas `.env.example` sincronizadas entre Backend y Frontend.
2. **Protección de Secretos**: Reglas estrictas en `.gitignore` y `.dockerignore` para evitar que secretos locales se filtren al repositorio o a las imágenes de Docker.
3. **Validación Temprana (Fail-Fast)**: Utilidad de validación ejecutada en `src/main.ts` antes de instanciar los módulos dependientes de configuración.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STARTUP CONFIGURATION FLOW                                │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                                   ┌────────────────┐
                                   │  dotenv/config │
                                   └────────┬───────┘
                                            │
                                            ▼
                                ┌──────────────────────┐
                                │ validateEnvConfig()  │
                                └───────────┬──────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼ (Variables válidas / Dev)                     ▼ (Falta config crítica en Prod)
         ┌─────────────────────┐                          ┌──────────────────────────┐
         │ NestFactory.create  │                          │ Salida con Error Claro   │
         │ Servidor en línea   │                          │ process.exit(1)          │
         └─────────────────────┘                          └──────────────────────────┘
```

---

## 1. Especificación de Variables de Entorno (Backend)

| Variable | Tipo | Requerida en Prod | Default en Dev | Descripción |
| :--- | :--- | :---: | :--- | :--- |
| `PORT` | Número | No | `3001` (o `3000`) | Puerto en el que escucha el servidor NestJS. |
| `DATABASE_URL` | String | Sí | `file:./dev.db` | URL de conexión de Prisma (SQLite local o PostgreSQL en prod). |
| `JWT_SECRET` | String | Sí | `super-secret-key-evalia` | Clave secreta para firmar/verificar tokens JWT de sesión. |
| `GOOGLE_CLIENT_ID` | String | Sí | - | Client ID de Google OAuth para autenticar docentes. |
| `UPLOADS_DIR` | String | No | `uploads` | Directorio donde se almacenan las entregas y documentos. |
| `MAX_UPLOAD_SIZE_MB` | Número | No | `10` | Tamaño máximo permitido por archivo subido (en Megabytes). |
| `GEMINI_API_KEY` | String | Sí | - | API Key de Google Gemini para generación de exámenes y corrección. |
| `GEMINI_MODEL` | String | No | `gemini-3.1-flash-lite` | Modelo principal de Gemini a invocar. |
| `OPENROUTER_API_KEY` | String | No | - | API Key de OpenRouter utilizada para el mecanismo de contingencia/fallback. |
| `OPENROUTER_MODEL` | String | No | `openai/gpt-4o-mini` | Modelo secundario de contingencia en OpenRouter. |
| `AI_TIMEOUT_MS` | Número | No | `15000` | Tiempo de espera límite (ms) para llamadas a servicios de IA. |
| `NODE_ENV` | String | No | `development` | Entorno de ejecución (`development`, `production`, `test`). |

---

## 2. Especificación de Variables de Entorno (Frontend)

| Variable | Tipo | Requerida | Descripción |
| :--- | :--- | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | String | Sí | URL base del backend NestJS (ej. `http://localhost:3001/api/v1` en local). |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | String | Sí | Client ID público de Google OAuth para el botón de login en React. |

---

## 3. Mecanismo de Validación Ligera (`env.validator.ts`)

La función `validateEnvConfig()` realizará las siguientes comprobaciones:
- Si `NODE_ENV === 'test'`, se omiten validaciones bloqueantes para no interferir con jest.
- Emite advertencias (`console.warn`) en modo desarrollo si faltan `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID` o si `JWT_SECRET` utiliza el valor por defecto genérico.
- En modo producción (`NODE_ENV === 'production'`), verifica que `JWT_SECRET` no sea el valor por defecto y que `DATABASE_URL` esté configurada.

---

## 4. Blindaje de Control de Versiones

Se reforzarán [.gitignore](file:///c:/Users/valen/OneDrive/Desktop/BackPasantia/Backend-App/.gitignore) y [.dockerignore](file:///c:/Users/valen/OneDrive/Desktop/BackPasantia/Backend-App/.dockerignore) agregando:
```gitignore
# Environment files
.env
.env.local
.env.*.local
.env.development
.env.test
.env.production
```
