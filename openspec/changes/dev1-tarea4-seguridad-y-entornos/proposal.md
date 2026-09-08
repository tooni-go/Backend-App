# Proposal: Seguridad, Rotación de Secretos y Estandarización de Entornos (Tarea 4)

## Problem Statement
Durante las primeras fases de desarrollo, las variables de entorno y claves de API (Gemini, OpenRouter, JWT, Google OAuth) crecieron sin una estandarización formal y con riesgo de exposición si no se aíslan correctamente en `.gitignore` y `.dockerignore`. Además, los desarrolladores nuevos necesitan una plantilla clara y documentada (`.env.example`) para levantar el entorno sin consultar valores sensibles directamente a otros miembros del equipo.

## Scope
1. **Estandarización de Variables de Entorno**:
   - Crear un archivo `.env.example` en el Backend y en el Frontend documentando cada variable, su propósito y valores por defecto/ejemplo.
2. **Hardening de `.gitignore` y `.dockerignore`**:
   - Asegurar que todas las variantes de `.env` (`.env`, `.env.local`, `.env.*.local`, `.env.production`) estén excluidas de control de versiones y de las imágenes Docker finales.
3. **Rotación y Buenas Prácticas de Secretos**:
   - Rotar las claves de Gemini y OpenRouter expuestas previamente y dejar el sistema preparado para inyectar secretos mediante variables de entorno seguras en CI/CD y producción.
