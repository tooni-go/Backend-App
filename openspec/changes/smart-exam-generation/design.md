# Design: Carga Inteligente de Exámenes (Smart Exam Generation)

## Architecture Overview

El flujo de Carga Inteligente permite a los docentes transformar material no estructurado (texto libre, archivos PDF, imágenes escaneadas o notas en TXT) en un examen estructurado listo para ser revisado y guardado en un curso.

```text
[Cliente / Frontend]
        │
        ▼ (POST /api/v1/examenes/generar)
[ExamenesController]
        │
        ▼ (generateExam)
[AiService]
        │
        ├── 1. Validación de Entrada y Formatos MIME
        │      - TXT -> Conversión directa a UTF-8
        │      - PDF / JPG / PNG / WEBP -> Multimodal (Base64)
        │
        ├── 2. Proveedor Principal: Gemini API (gemini-1.5-flash)
        │      - Timeout: 15 segundos
        │      - Formato: JSON Object
        │
        ├── 3. Proveedor Secundario (Fallback): OpenRouter (openai/gpt-4o-mini)
        │      - Activado ante timeout, 429 quota o 5xx
        │
        └── 4. Validación Estricta con Zod (GeneratedExamSchema)
               - titulo: string
               - preguntas: Array<{ enunciado, respuestaEsperada, puntajeMaximo, esEvaluacionVisual }>
```

## Data Contracts & Schemas

### Zod Schemas

```typescript
export const GeneratedQuestionSchema = z.object({
  enunciado: z.string().min(1),
  respuestaEsperada: z.string().min(1),
  puntajeMaximo: z.number().positive(),
  esEvaluacionVisual: z.boolean().default(false),
});

export const GeneratedExamSchema = z.object({
  titulo: z.string().min(1),
  preguntas: z.array(GeneratedQuestionSchema).min(1),
});
```

## Error Handling Guidelines
- Si el cliente no envía ni texto ni archivo, se responde `400 Bad Request`.
- Si el archivo tiene un tipo MIME no soportado, se responde `400 Bad Request` indicando los formatos válidos.
- Si ambos proveedores de IA fallan o agotan su tiempo de espera, se lanza una excepción explícita con código `500` / `502`, evitando en todo momento la generación de datos simulados o ficticios.
