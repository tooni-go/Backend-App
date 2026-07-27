import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export const AiQuestionEvaluationSchema = z.object({
  preguntaId: z.string(),
  textoDetectado: z.string(),
  observaciones: z.string(),
  puntajeSugerido: z.number().min(0),
});

export const AiEvaluationSchema = z.object({
  preguntas: z.array(AiQuestionEvaluationSchema),
  notaIA: z.number().min(0),
  nivelConfianza: z.enum(['BAJO', 'MEDIO', 'ALTO']),
});

export type AiEvaluation = z.infer<typeof AiEvaluationSchema>;

interface QuestionData {
  id: string;
  enunciado: string;
  respuestaEsperada: string;
  puntajeMaximo: number;
  criteriosIA?: string | null;
  esEvaluacionVisual: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * Evalúa una entrega utilizando Gemini con fallback automático hacia OpenRouter.
   * Determina también el estado de la entrega en base a las reglas de negocio.
   */
  async evaluateSubmission(
    fileBuffer: Buffer,
    mimeType: string,
    questions: QuestionData[],
  ): Promise<{ evaluation: AiEvaluation | null; finalState: string }> {
    const prompt = this.buildPrompt(questions);
    const fileBase64 = fileBuffer.toString('base64');
    let responseText = '';
    let usedFallback = false;

    // 1. Intentar llamar a Gemini API (Proveedor principal)
    try {
      this.logger.log('Iniciando evaluación con Gemini API...');
      responseText = await this.callGeminiWithTimeout(fileBase64, mimeType, prompt);
      this.logger.log('Respuesta recibida exitosamente de Gemini.');
    } catch (error) {
      this.logger.error(`Fallo en Gemini API: ${error.message || error}. Conmutando a OpenRouter...`);
      usedFallback = true;
      
      // 2. Fallback a OpenRouter (Proveedor secundario)
      try {
        responseText = await this.callOpenRouter(fileBase64, mimeType, prompt);
        this.logger.log('Respuesta recibida exitosamente de OpenRouter.');
      } catch (fallbackError) {
        this.logger.error(`Fallo también en el fallback de OpenRouter: ${fallbackError.message || fallbackError}`);
        return { evaluation: null, finalState: 'REQUIERE_REVISION' };
      }
    }

    // 3. Procesar y Validar la respuesta JSON
    try {
      const cleanJson = this.cleanMarkdownJson(responseText);
      const parsedData = JSON.parse(cleanJson);
      
      const validation = AiEvaluationSchema.safeParse(parsedData);
      if (!validation.success) {
        this.logger.warn(`La respuesta de la IA no respeta el esquema requerido: ${validation.error.message}`);
        return { evaluation: null, finalState: 'REQUIERE_REVISION' };
      }

      const evaluation = validation.data;

      // 4. Determinar el estado en base a reglas de negocio
      // Regla A: Si alguna pregunta requiere evaluación visual/gráfica, requiere revisión del docente.
      const hasVisualQuestions = questions.some((q) => q.esEvaluacionVisual);

      // Regla B: Si el nivel de confianza de la IA es bajo, requiere revisión.
      const isLowConfidence = evaluation.nivelConfianza === 'BAJO';

      let finalState = 'PENDIENTE_APROBACION';
      if (hasVisualQuestions || isLowConfidence) {
        finalState = 'REQUIERE_REVISION';
        this.logger.log(
          `Entrega asignada a REQUIERE_REVISION. Motivo: ` +
          `${hasVisualQuestions ? '[Contiene preguntas visuales] ' : ''}` +
          `${isLowConfidence ? '[Nivel de confianza BAJO]' : ''}`
        );
      } else {
        this.logger.log(`Entrega asignada a PENDIENTE_APROBACION.`);
      }

      return { evaluation, finalState };
    } catch (parseError) {
      this.logger.error(`Error al procesar el JSON devuelto por la IA: ${parseError.message}`);
      return { evaluation: null, finalState: 'REQUIERE_REVISION' };
    }
  }

  /**
   * Construye el prompt con las especificaciones de las preguntas y la estructura del JSON esperado.
   */
  private buildPrompt(questions: QuestionData[]): string {
    const questionsDescription = questions
      .map((q, index) => {
        return `Pregunta ${index + 1}:
  - ID: ${q.id}
  - Enunciado: ${q.enunciado}
  - Respuesta Esperada: ${q.respuestaEsperada}
  - Puntaje Máximo: ${q.puntajeMaximo}
  ${q.criteriosIA ? `- Criterios adicionales: ${q.criteriosIA}` : ''}
  - Requiere evaluación visual: ${q.esEvaluacionVisual ? 'Sí' : 'No'}`;
      })
      .join('\n\n');

    return `Actúa como un profesor asistente evaluando un examen manuscrito.
Analiza la imagen o documento provisto del examen realizado por el alumno y compáralo con las siguientes preguntas y respuestas esperadas:

${questionsDescription}

Para cada pregunta debes:
1. Transcribir la respuesta manuscrita del alumno en el campo "textoDetectado". Si no escribió nada, está en blanco, o es completamente ilegible, indícalo textualmente.
2. Sugerir un puntaje ("puntajeSugerido") entre 0 y el puntaje máximo asignado a la pregunta.
3. Escribir observaciones detalladas en el campo "observaciones" explicando por qué se asignó ese puntaje (con qué parte de la respuesta esperada coincide o difiere).

Calcula la nota total sugerida ("notaIA") como la suma de los puntajes sugeridos de todas las preguntas.
Determina también el nivel de confianza de tu evaluación general ("nivelConfianza"):
- "ALTO": Si las respuestas escritas son muy legibles y la evaluación es certera.
- "MEDIO": Si hay dudas menores de legibilidad o ambigüedades en las respuestas.
- "BAJO": Si la caligrafía es extremadamente difícil de leer, incompleta o el archivo está muy borroso.

IMPORTANTE: Debes retornar EXCLUSIVAMENTE un objeto JSON válido que respete el siguiente formato. No incluyas bloques de código markdown (\`\`\`json ... \`\`\`), texto aclaratorio, explicaciones o saludos antes o después de la estructura:

{
  "preguntas": [
    {
      "preguntaId": "id-de-la-pregunta",
      "textoDetectado": "transcripción de la respuesta del alumno",
      "observaciones": "observaciones del corrector",
      "puntajeSugerido": 2.5
    }
  ],
  "notaIA": 2.5,
  "nivelConfianza": "ALTO"
}`;
  }

  /**
   * Ejecuta la llamada a Gemini con un timeout de 15 segundos.
   */
  private async callGeminiWithTimeout(
    fileBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurado en el entorno.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Usamos gemini-1.5-flash que es rápido, económico y soporta análisis visual
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const filePart = {
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    };

    // Timeout Promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout de 15 segundos en Gemini API alcanzado')), 15000),
    );

    // Call Promise
    const apiCallPromise = (async () => {
      const result = await model.generateContent([prompt, filePart]);
      const text = result.response.text();
      if (!text) {
        throw new Error('Respuesta vacía recibida de Gemini API.');
      }
      return text;
    })();

    return Promise.race([apiCallPromise, timeoutPromise]);
  }

  /**
   * Ejecuta la llamada de fallback a OpenRouter.
   */
  private async callOpenRouter(
    fileBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY no configurado en el entorno.');
    }

    const modelName = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    this.logger.log(`Llamando a OpenRouter usando el modelo: ${modelName}...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://evalia.com',
        'X-Title': 'EvalIA',
      },
      body: JSON.stringify({
        model: modelName,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${fileBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API respondió con estado ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Respuesta vacía de OpenRouter API.');
    }
    return text;
  }

  /**
   * Limpia posibles marcas de formato markdown si la IA ignora las instrucciones de formato limpio.
   */
  private cleanMarkdownJson(text: string): string {
    let clean = text.trim();
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```json\s*/i, '');
      clean = clean.replace(/```$/, '');
    }
    return clean.trim();
  }
}
