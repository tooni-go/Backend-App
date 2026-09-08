# Design: Seguridad, Rotación de Secretos y Estandarización de Entornos (Tarea 4)

## Architecture Overview

El diseño aborda la gestión de configuración en tres niveles:
1. **Definición y Documentación**: Plantillas `.env.example` sincronizadas entre Backend y Frontend.
2. **Protección de Secretos**: Reglas estrictas en `.gitignore` y `.dockerignore` para evitar que secretos locales se filtren al repositorio o a las imágenes de Docker.
3. **Consistencia de Entornos**: Estandarización de puertos y URLs de conexión entre Frontend (Next.js) y Backend (NestJS).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENVIRONMENT ARCHITECTURE                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
             ┌─────────────────────┐                 ┌─────────────────────┐
             │   Backend (NestJS)  │                 │  Frontend (Next.js) │
             │     .env.example    │                 │     .env.example    │
             └──────────┬──────────┘                 └──────────┬──────────┘
                        │                                       │
                        ├── DATABASE_URL                        ├── NEXT_PUBLIC_API_URL
                        ├── PORT                                └── NEXT_PUBLIC_GOOGLE_CLIENT_ID
                        ├── JWT_SECRET
                        ├── GOOGLE_CLIENT_ID
                        ├── UPLOADS_DIR & MAX_UPLOAD_SIZE_MB
                        └── GEMINI & OPENROUTER API KEYS
```

## Security Guidelines
- Ningún archivo `.env` o variante debe commitearse en Git.
- En producción, las variables se inyectan a través de los paneles de configuración de la plataforma de hosting (Render/Vercel) o como GitHub Actions Secrets.
- En desarrollo local, cada desarrollador copia `.env.example` a `.env` y completa sus valores locales.
