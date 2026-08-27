## Why

Para agilizar el proceso de creación de evaluaciones por parte de los docentes en EvalIA, se requiere una funcionalidad de "Carga Inteligente" (generación asistida de exámenes mediante IA). Para garantizar una experiencia de usuario óptima y permitir al docente supervisar y corregir el contenido antes de la formulación de preguntas, el flujo se estructura en dos fases desacopladas:
1. **Extracción de Texto**: Extracción cruda y fiel del material (documentos TXT, DOCX, PDF o imágenes) para que el docente pueda visualizar y editar el contenido antes de la IA.
2. **Generación de Examen**: Generación formal del examen con título, preguntas estructuradas, respuestas esperadas y criterios de puntaje a partir del texto definitivo.

## What Changes

- Creación del endpoint dedicado `POST /api/v1/documentos/extraer-texto` para procesar archivos multiformato (TXT, DOCX, PDF, JPG, PNG, WEBP).
- Soporte determinístico de extracción para `.docx` (mediante `mammoth`) y `.txt` (buffer directo en UTF-8) sin consumo de cuota de IA.
- Transcripción fiel y libre de alucinaciones para PDFs e imágenes mediante IA (Gemini API con fallback automático a OpenRouter).
- Creación de un nuevo contrato de datos con Zod (`GeneratedQuestionSchema`, `GeneratedExamSchema`) para la salida estructurada de la IA en la generación de exámenes.
- Extensión de `AiService` con los métodos `extractTextFromDocument` y `generateExam`, incorporando soporte multimodal y texto plano, validación de tipos MIME y el flujo de resiliencia con proveedor principal Gemini API y conmutación por error (fallback) a OpenRouter.
- Creación del módulo y controlador `ExamenesController` con el endpoint `POST /api/v1/examenes/generar`, soportando tanto payloads JSON como `multipart/form-data`.
- Validación estricta de formatos de archivos permitidos y manejo explícito de errores pedagógicos sin datos ficticios.

## Capabilities

### New Capabilities
- `document-extraction`: Endpoint y servicio para extracción de texto crudo de documentos e imágenes (TXT, DOCX, PDF, JPG, PNG, WEBP), clasificando la fuente y señalando la necesidad de revisión para fuentes con IA.
- `exam-generation`: Servicio y endpoint REST para la generación automática y estructurada de exámenes completos a partir de texto o documentos adjuntos, validando la estructura del JSON con Zod y garantizando alta disponibilidad con arquitectura de fallback.

### Modified Capabilities

## Impact

- **Código Afectado**: `src/ai/ai.service.ts`, `src/app.module.ts`, `src/documentos/*`, `src/examenes/*`.
- **APIs**: Nuevos endpoints `POST /api/v1/documentos/extraer-texto` y `POST /api/v1/examenes/generar`.
- **Dependencias**: Utiliza `mammoth`, `@google/genai` (SDK oficial moderno de Google Gen AI) y `zod`.

