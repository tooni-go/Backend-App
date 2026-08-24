## Why

Para agilizar el proceso de creación de evaluaciones por parte de los docentes en EvalIA, se requiere una funcionalidad de "Carga Inteligente" (generación asistida de exámenes mediante IA). Esta función permite al profesor pegar consignas en texto o subir un archivo (PDF, TXT, imágenes de exámenes previos o temarios curriculares) para que la IA genere automáticamente una propuesta formal de examen con título, preguntas estructuradas, respuestas modelo esperadas, puntajes máximos y la detección de si alguna consigna requiere evaluación visual.

## What Changes

- Creación de un nuevo contrato de datos con Zod (`GeneratedQuestionSchema`, `GeneratedExamSchema`) para la salida estructurada de la IA en la generación de exámenes.
- Extensión de `AiService` con el método `generateExam`, incorporando soporte multimodal y texto plano, validación de tipos MIME y el flujo de resiliencia con proveedor principal Gemini API y conmutación por error (fallback) a OpenRouter.
- Creación del módulo y controlador `ExamenesController` con el endpoint `POST /api/v1/examenes/generar`, soportando tanto payloads JSON como `multipart/form-data`.
- Validación estricta de formatos de archivos permitidos y manejo explícito de errores pedagógicos sin datos ficticios.

## Capabilities

### New Capabilities
- `exam-generation`: Servicio y endpoint REST para la generación automática y estructurada de exámenes completos a partir de texto o documentos adjuntos (PDF/imágenes/TXT), validando la estructura del JSON con Zod y garantizando alta disponibilidad con arquitectura de fallback.

### Modified Capabilities

## Impact

- **Código Afectado**: `src/ai/ai.service.ts`, `src/app.module.ts`, `src/examenes/*`.
- **APIs**: Nuevo endpoint `POST /api/v1/examenes/generar`.
- **Dependencias**: Utiliza `@google/genai` (SDK oficial moderno de Google Gen AI) y `zod`.
