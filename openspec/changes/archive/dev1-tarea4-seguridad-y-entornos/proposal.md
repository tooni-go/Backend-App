# Proposal: Seguridad, Rotación de Secretos y Estandarización de Entornos (Tarea 4)

## Why

Para garantizar un entorno de desarrollo, integración continua (CI), dockerización y despliegue (CD) robusto y seguro, es imprescindible estandarizar todas las variables de entorno utilizadas por la aplicación, evitar la filtración accidental de credenciales sensibles en el control de versiones y validar que la configuración mínima requerida esté presente al inicializar el servidor.

Actualmente, el backend hace uso de variables de entorno críticas (como `JWT_SECRET`, `GOOGLE_CLIENT_ID` y `AI_TIMEOUT_MS`) que no se encuentran documentadas en `.env.example`, y no existe un mecanismo de validación preventiva (fail-fast) al iniciar la aplicación, lo que puede provocar fallos silenciosos o comportamientos inesperados en runtime.

## What Changes

1. **Estandarización Integral de `.env.example` (Backend)**:
   - Documentar exhaustivamente cada variable requerida y opcional agrupada por dominios funcionales (Base de Datos, Servidor, Autenticación, Almacenamiento e Inteligencia Artificial).
   - Incluir valores por defecto seguros para desarrollo local y notas explícitas para producción.

2. **Estandarización de `.env.example` (Frontend)**:
   - Proveer la plantilla de variables públicas requeridas por Next.js (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`).

3. **Validación Preventiva de Entorno (Fail-Fast Startup)**:
   - Crear un módulo/utilidad liviana `src/common/config/env.validator.ts` que se ejecute durante el `bootstrap` en `src/main.ts`.
   - Verificar la presencia de variables esenciales, emitiendo advertencias claras en desarrollo e impidiendo el arranque si faltan configuraciones críticas en producción.
   - Diseñado para no interferir ni romper la ejecución de suites de pruebas unitarias (`NODE_ENV=test`).

4. **Refuerzo de Seguridad y Prevención de Fugas (`.gitignore` & `.dockerignore`)**:
   - Ampliar las reglas de exclusión para abarcar patrones como `.env.local`, `.env.*.local`, `.env.production` y certificados temporales.

## Capabilities

### New Capabilities
- `env-standardization-and-security`: Estandarización completa de variables de entorno y validación fail-fast durante el arranque del sistema.

## Impact

- **Código Afectado**:
  - `.env.example` (Backend) [MODIFY]
  - `.gitignore` [MODIFY]
  - `.dockerignore` [MODIFY]
  - `src/common/config/env.validator.ts` [NEW]
  - `src/main.ts` [MODIFY]
- **Documentación**:
  - Especificación de `.env.example` para Frontend.
