# Design: Carga Inteligente de Exámenes (Smart Exam Generation)

## Architecture Overview

El flujo de Carga Inteligente permite a los docentes transformar material no estructurado (texto libre, archivos DOCX, PDF, imágenes escaneadas o notas en TXT) en un examen estructurado listo para ser revisado y guardado en un curso.

Para otorgar mayor control al docente, el sistema separa la extracción de texto de la generación de consignas:

```text
PASO 1: EXTRACCIÓN DE TEXTO
[Cliente / Frontend]
        │
        ▼ (POST /api/v1/documentos/extraer-texto)
[DocumentosController]
        │
        ▼ (extractText)
[DocumentosService]
        │
        ├── TXT -> Decodificación directa UTF-8 (Determinístico, sin IA, requiereRevision: false)
        ├── DOCX -> Extracción con mammoth (Determinístico, sin IA, requiereRevision: false)
        └── PDF / Imágenes -> AiService.extractTextFromDocument (requiereRevision: true)
                │
                ├── Gemini API (Proveedor principal - OCR/Transcripción literal)
                └── OpenRouter (Fallback automático ante fallas o timeout)

PASO 2: REVISIÓN / EDICIÓN Y GENERACIÓN DE EXAMEN
[Cliente / Frontend] (Docente revisa/edita texto extraído)
        │
        ▼ (POST /api/v1/examenes/generar con { texto })
[ExamenesController]
        │
        ▼ (generateExam)
[AiService] -> Gemini / Fallback OpenRouter -> Validación Zod (GeneratedExamSchema)
```

> **Nota sobre el flujo conectado**: `POST /api/v1/examenes/generar` es el endpoint unificado de generación de exámenes. Cuando se ejecuta como Paso 2 tras la extracción documental (`POST /api/v1/documentos/extraer-texto`), recibe el payload `{ texto: string }` con el contenido ya revisado o editado por el docente. En este caso, el backend no ejecuta ninguna re-extracción ni procesamiento intermedio de archivos: el texto fluye directo a la construcción del prompt de generación en `AiService`.


## Data Contracts & Schemas

### DTOs de Extracción de Texto

```typescript
export type FuenteTipo = 'txt' | 'docx' | 'pdf' | 'imagen';

export interface ExtraerTextoResponseDto {
  textoExtraido: string;
  fuenteTipo: FuenteTipo;
  requiereRevision: boolean;
}
```

### Zod Schemas de Generación de Exámenes

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
- Si el cliente no envía el archivo en `POST /api/v1/documentos/extraer-texto`, se responde `400 Bad Request`.
- Si el archivo tiene un tipo MIME no soportado, se responde `400 Bad Request` indicando los formatos válidos (TXT, DOCX, PDF, JPG, PNG, WEBP).
- Si el archivo supera el límite de tamaño (`MAX_UPLOAD_SIZE_MB`), se responde `400 Bad Request`.
- Si el archivo procesado por IA no contiene texto identificable, se devuelve `textoExtraido: ''` con `requiereRevision: true` sin fabricar datos.
- Si ambos proveedores de IA fallan o agotan su tiempo de espera, se lanza una excepción explícita con código `500` / `502`, evitando en todo momento la generación de datos simulados o ficticios.

