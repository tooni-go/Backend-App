import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export const SUPPORTED_SUBMISSION_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const SUPPORTED_EXAM_GENERATION_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
];

export const SUPPORTED_EXTRACTION_AI_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];


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

export const GeneratedQuestionSchema = z.object({
  enunciado: z.string().min(1, 'El enunciado no puede estar vacío'),
  respuestaEsperada: z
    .string()
    .min(1, 'La respuesta esperada no puede estar vacía'),
  puntajeMaximo: z
    .number()
    .positive('El puntaje máximo debe ser un número positivo')
    .min(1, 'El puntaje máximo por pregunta debe ser al menos 1')
    .max(100, 'El puntaje máximo por pregunta no puede exceder 100'),
  criteriosIA: z
    .string()
    .min(1, 'Los criterios de corrección por IA no pueden estar vacíos'),
  esEvaluacionVisual: z.boolean().default(false),
});

export const GeneratedExamSchema = z
  .object({
    titulo: z.string(),
    preguntas: z.array(GeneratedQuestionSchema),
  })
  .refine(
    (data) =>
      (data.titulo === '' && data.preguntas.length === 0) ||
      (data.titulo.trim().length > 0 && data.preguntas.length > 0),
    {
      message:
        'El examen debe contener un título y al menos una pregunta válida, o bien ser un examen vacío ({ titulo: "", preguntas: [] }) si el material no tiene sentido pedagógico.',
    },
  );

export type GeneratedExam = z.infer<typeof GeneratedExamSchema>;
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

interface QuestionData {
  id: string;
  enunciado: string;
  respuestaEsperada: string;
  puntajeMaximo: number;
  criteriosIA?: string | null;
  esEvaluacionVisual: boolean;
}

export interface GenerateExamInput {
  texto?: string;
  fileBuffer?: Buffer;
  mimeType?: string;
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
    // Validar tipo de archivo antes de realizar llamadas de red
    if (!SUPPORTED_SUBMISSION_MIME_TYPES.includes(mimeType)) {
      this.logger.error(
        `Tipo de archivo rechazado: ${mimeType}. Formatos permitidos: JPG, PNG, WEBP, PDF.`,
      );
      return { evaluation: null, finalState: 'REQUIERE_REVISION' };
    }

    const prompt = this.buildPrompt(questions);
    const fileBase64 = fileBuffer.toString('base64');
    let responseText = '';

    // 1. Intentar llamar a Gemini API (Proveedor principal)
    try {
      this.logger.log('Iniciando evaluación con Gemini API...');
      responseText = await this.callGeminiWithTimeout(
        fileBase64,
        mimeType,
        prompt,
      );
      this.logger.log('Respuesta recibida exitosamente de Gemini.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Fallo en Gemini API: ${errorMessage}. Conmutando a OpenRouter...`,
      );

      // 2. Fallback a OpenRouter (Proveedor secundario)
      try {
        responseText = await this.callOpenRouter(fileBase64, mimeType, prompt);
        this.logger.log('Respuesta recibida exitosamente de OpenRouter.');
      } catch (fallbackError: unknown) {
        const fbMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        this.logger.error(
          `Fallo también en el fallback de OpenRouter: ${fbMessage}`,
        );
        return { evaluation: null, finalState: 'REQUIERE_REVISION' };
      }
    }

    // 3. Procesar y Validar la respuesta JSON
    try {
      const cleanJson = this.cleanMarkdownJson(responseText);
      const parsedData: unknown = JSON.parse(cleanJson);

      const validation = AiEvaluationSchema.safeParse(parsedData);
      if (!validation.success) {
        this.logger.warn(
          `La respuesta de la IA no respeta el esquema requerido: ${validation.error.message}`,
        );
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
            `${isLowConfidence ? '[Nivel de confianza BAJO]' : ''}`,
        );
      } else {
        this.logger.log(`Entrega asignada a PENDIENTE_APROBACION.`);
      }

      return { evaluation, finalState };
    } catch (parseError: unknown) {
      const parseMessage =
        parseError instanceof Error ? parseError.message : String(parseError);
      this.logger.error(
        `Error al procesar el JSON devuelto por la IA: ${parseMessage}`,
      );
      return { evaluation: null, finalState: 'REQUIERE_REVISION' };
    }
  }

  /**
   * Genera un examen estructurado (Carga Inteligente) a partir de texto o archivo subido.
   * Utiliza Gemini API como proveedor principal y OpenRouter como fallback.
   */
  async generateExam(input: GenerateExamInput): Promise<GeneratedExam> {
    let rawText = input.texto?.trim() || '';
    let fileBase64: string | undefined = undefined;
    let mimeType: string | undefined = input.mimeType;

    if (input.fileBuffer) {
      if (input.mimeType === 'text/plain') {
        const fileContent = input.fileBuffer.toString('utf-8');
        rawText = rawText ? `${rawText}\n\n${fileContent}` : fileContent;
      } else if (
        input.mimeType &&
        SUPPORTED_EXAM_GENERATION_MIME_TYPES.includes(input.mimeType)
      ) {
        fileBase64 = input.fileBuffer.toString('base64');
        mimeType = input.mimeType;
      } else {
        throw new BadRequestException(
          `Formato de archivo no soportado para Carga Inteligente: ${input.mimeType || 'desconocido'}. Formatos aceptados: TXT, PDF, JPG, PNG, WEBP.`,
        );
      }
    }

    if (!rawText && !fileBase64) {
      throw new BadRequestException(
        'Debe proporcionar un texto con las consignas o adjuntar un archivo (PDF/imagen/TXT) para generar el examen.',
      );
    }

    const prompt = this.buildGenerateExamPrompt(rawText);

    // 1. Intentar llamar a Gemini API (Proveedor principal) y validar respuesta
    try {
      this.logger.log(
        'Iniciando Carga Inteligente de Examen con Gemini API...',
      );
      const geminiResponseText = await this.callGeminiForExamGeneration(
        prompt,
        fileBase64,
        mimeType,
      );
      const exam = this.parseAndValidateExamJson(geminiResponseText);
      this.logger.log('Examen generado y validado exitosamente con Gemini.');
      return exam;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Fallo en Gemini API durante generación de examen: ${errorMessage}. Conmutando a OpenRouter...`,
      );

      // 2. Fallback a OpenRouter (Proveedor secundario) y validar respuesta
      try {
        const openRouterResponseText =
          await this.callOpenRouterForExamGeneration(
            prompt,
            fileBase64,
            mimeType,
          );
        const exam = this.parseAndValidateExamJson(openRouterResponseText);
        this.logger.log('Examen generado y validado exitosamente con OpenRouter.');
        return exam;
      } catch (fallbackError: unknown) {
        const fbMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        this.logger.error(
          `Fallo también en el fallback de OpenRouter para generación de examen: ${fbMessage}`,
        );
        throw new InternalServerErrorException(
          'No fue posible generar el examen con los servicios de IA disponibles. Por favor, intente nuevamente más tarde.',
        );
      }
    }
  }

  /**
   * Limpia, parsea y valida el JSON devuelto por los modelos de IA contra el esquema GeneratedExamSchema.
   */
  private parseAndValidateExamJson(responseText: string): GeneratedExam {
    try {
      const cleanJson = this.cleanMarkdownJson(responseText);
      const parsedData: unknown = JSON.parse(cleanJson);

      const validation = GeneratedExamSchema.safeParse(parsedData);
      if (!validation.success) {
        this.logger.warn(
          `El examen generado por la IA no cumple con el esquema esperado: ${validation.error.message}`,
        );
        throw new Error(
          `El JSON generado no cumple con el esquema requerido: ${validation.error.message}`,
        );
      }

      return validation.data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error al interpretar el JSON del examen: ${message}. Respuesta recibida:\n${responseText}`,
      );
      throw new Error(`Error al interpretar el examen generado: ${message}`);
    }
  }

  /**
   * Construye el prompt para la Carga Inteligente de Exámenes.
   */
  private buildGenerateExamPrompt(texto?: string): string {
    return `Actúa como un profesor asistente pedagógico de nivel secundario/universitario especializado en diseño curricular.
Tu tarea es analizar el material, temario o consignas provistas por el docente y generar un examen formal, estructurado y completo con sus preguntas y criterios de corrección.

${texto ? `CONTENIDO / CONSIGNAS PROVISTAS POR EL DOCENTE:\n"""\n${texto}\n"""\n` : ''}

REGLAS DE GENERACIÓN PEDAGÓGICA:
1. "titulo": Asigna un título claro y representativo del tema evaluado (ej. "Evaluación de Álgebra y Funciones Polinómicas").
2. "preguntas": Genera una lista de preguntas claras y no ambiguas basadas estrictamente en el material provisto o el tema solicitado.
   Para cada pregunta debes definir obligatoriamente:
   - "enunciado": La consigna o pregunta formal que responderá el alumno.
   - "respuestaEsperada": La respuesta modelo correcta, desarrollo esperado, o criterios clave que deben estar presentes para considerar la respuesta correcta.
   - "puntajeMaximo": Puntaje numérico asignado a la pregunta (entre 1 y 100). La suma total de los puntajes debe totalizar una escala redonda (ej. 10 o 100 puntos).
   - "criteriosIA": Descripción detallada de qué debe buscar el corrector (humano o IA) al evaluar esa respuesta — por ejemplo, qué conceptos clave indispensables deben estar presentes, qué errores comunes penalizar, o cómo repartir el puntaje si la respuesta es parcialmente correcta. No puede estar vacío.
   - "esEvaluacionVisual": Booleano (true o false). Marca 'true' ÚNICAMENTE si la resolución del alumno exige obligatoriamente un dibujo, gráfico de ejes cartesianos, diagrama de flujo, esquema anatómico o construcción geométrica que requiera inspección visual humana. En caso de respuestas puramente textuales, numéricas o de desarrollo algebraico, debe ser 'false'.
3. Si el contenido provisto no tiene sentido pedagógico identificable (texto sin significado, caracteres aleatorios o material insuficiente), responde con un JSON vacío { "titulo": "", "preguntas": [] } en lugar de inventar un tema.

REQUISITO ESTRICTO DE FORMATO:
Debes responder EXCLUSIVAMENTE un objeto JSON válido con la estructura indicada a continuación. No incluyas bloques de formato markdown (\`\`\`json ... \`\`\`), ni introducciones, explicaciones, comentarios o saludos antes o después del JSON:

{
  "titulo": "Título formal del Examen",
  "preguntas": [
    {
      "enunciado": "Consigna de la pregunta",
      "respuestaEsperada": "Respuesta modelo o criterios de resolución esperados",
      "puntajeMaximo": 5,
      "criteriosIA": "Conceptos clave requeridos, penalizaciones por errores comunes y distribución de puntaje parcial.",
      "esEvaluacionVisual": false
    }
  ]
}`;
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
   * Ejecuta la llamada a Gemini para corrección con un timeout de 15 segundos.
   */
  private async callGeminiWithTimeout(
    fileBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurado en el entorno.');
    }

    if (!SUPPORTED_SUBMISSION_MIME_TYPES.includes(mimeType)) {
      throw new Error(
        `Tipo MIME no soportado: ${mimeType}. Formatos permitidos: JPG, PNG, WEBP, PDF.`,
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName =
      process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

    const filePart = {
      inlineData: {
        data: fileBase64,
        mimeType: mimeType,
      },
    };

    // Timeout Promise (30s)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error('Timeout de 30 segundos en Gemini API alcanzado')),
        30000,
      ),
    );

    // Call Promise
    const apiCallPromise = (async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: [filePart, prompt],
        config: {
          responseMimeType: 'application/json',
        },
      });
      const text = result.text;
      if (!text) {
        throw new Error('Respuesta vacía recibida de Gemini API.');
      }
      return text;
    })();

    return Promise.race([apiCallPromise, timeoutPromise]);
  }

  /**
   * Ejecuta la llamada a Gemini para Carga Inteligente de Exámenes (texto o multimodal) con timeout de 15s.
   */
  private async callGeminiForExamGeneration(
    prompt: string,
    fileBase64?: string,
    mimeType?: string,
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurado en el entorno.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName =
      process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

    const contents: Array<
      string | { inlineData: { data: string; mimeType: string } }
    > = [];

    if (fileBase64 && mimeType) {
      contents.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType,
        },
      });
    }
    contents.push(prompt);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error('Timeout de 30 segundos en Gemini API alcanzado')),
        30000,
      ),
    );

    const apiCallPromise = (async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const text = result.text;
      if (!text) {
        throw new Error('Respuesta vacía recibida de Gemini API.');
      }
      return text;
    })();

    return Promise.race([apiCallPromise, timeoutPromise]);
  }

  /**
   * Ejecuta la llamada de fallback a OpenRouter para corrección.
   */
  private async callOpenRouter(
    fileBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY no configurado en el entorno.');
    }

    const modelName =
      process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini';
    this.logger.log(`Llamando a OpenRouter usando el modelo: ${modelName}...`);

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenRouter API respondió con estado ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Respuesta vacía de OpenRouter API.');
    }
    return text;
  }

  /**
   * Ejecuta la llamada de fallback a OpenRouter para Carga Inteligente de Exámenes.
   */
  private async callOpenRouterForExamGeneration(
    prompt: string,
    fileBase64?: string,
    mimeType?: string,
  ): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY no configurado en el entorno.');
    }

    const modelName =
      process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini';
    this.logger.log(
      `Llamando a OpenRouter para generación de examen usando el modelo: ${modelName}...`,
    );

    const contents: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [{ type: 'text', text: prompt }];

    if (fileBase64 && mimeType) {
      contents.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${fileBase64}`,
        },
      });
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://evalia.com',
          'X-Title': 'EvalIA',
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: contents,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenRouter API respondió con estado ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Respuesta vacía de OpenRouter API.');
    }
    return text;
  }

  /**
   * Extrae y transcribe fielmente el texto contenido en una imagen o documento PDF utilizando IA.
   * Usa el cliente compartido invokeGemini/invokeOpenRouter (Gemini principal, OpenRouter como fallback).
   */
  async extractTextFromDocument(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    if (!SUPPORTED_EXTRACTION_AI_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo '${mimeType}' no soportado para extracción por IA. Formatos permitidos: JPG, PNG, WEBP, PDF.`,
      );
    }

    const fileBase64 = fileBuffer.toString('base64');
    const prompt = this.buildExtractTextPrompt();
    let extractedText = '';

    // 1. Intentar llamar a Gemini API (Proveedor principal)
    try {
      this.logger.log('Iniciando extracción de texto con Gemini API...');
      extractedText = await this.invokeGemini({
        prompt,
        fileBase64,
        mimeType,
        allowEmpty: true,
        timeoutErrorMessage:
          'Timeout de 30 segundos en Gemini API alcanzado durante extracción de texto',
      });
      this.logger.log('Texto extraído exitosamente con Gemini.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Fallo en Gemini API durante extracción de texto: ${errorMessage}. Conmutando a OpenRouter...`,
      );

      // 2. Fallback a OpenRouter (Proveedor secundario)
      try {
        extractedText = await this.invokeOpenRouter({
          prompt,
          fileBase64,
          mimeType,
          jsonResponse: false,
          allowEmpty: true,
          logLabel: 'extracción de texto',
        });
        this.logger.log('Texto extraído exitosamente con OpenRouter.');
      } catch (fallbackError: unknown) {
        const fbMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        this.logger.error(
          `Fallo también en el fallback de OpenRouter para extracción de texto: ${fbMessage}`,
        );
        throw new InternalServerErrorException(
          'No fue posible extraer el texto del documento con los servicios de IA disponibles. Por favor, intente nuevamente más tarde.',
        );
      }
    }

    return (extractedText || '').trim();
  }

  /**
   * Construye el prompt para la transcripción fiel de texto sin interpretaciones ni resúmenes.
   */
  private buildExtractTextPrompt(): string {
    return `Actúa como un transcriptor y sistema OCR de alta precisión.
Tu única tarea es transcribir exactamente todo el texto legible que aparece en el documento o imagen adjunta, respetando su redacción original, saltos de línea y estructura.

REGLAS ESTRICTAS:
1. No resumas, no interpretes, no agregues explicaciones, no corrijas errores ortográficos del original ni agregues introducciones o despedidas.
2. Transcribe únicamente el texto tal cual está escrito en el archivo.
3. Si el archivo está en blanco, es ilegible, borroso o no contiene ningún tipo de texto identificable, responde ÚNICAMENTE con una cadena vacía (sin texto de relleno ni aclaraciones).`;
  }

  /**
   * Cliente reutilizable de Gemini (SDK + timeout). Usado por extracción de texto;
   * generateExam conserva sus wrappers actuales para no alterar ese flujo.
   */
  private async invokeGemini(params: {
    prompt: string;
    fileBase64?: string;
    mimeType?: string;
    jsonResponse?: boolean;
    allowEmpty?: boolean;
    timeoutErrorMessage?: string;
  }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY no configurado en el entorno.');
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName =
      process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';

    const contents: Array<
      string | { inlineData: { data: string; mimeType: string } }
    > = [];

    if (params.fileBase64 && params.mimeType) {
      contents.push({
        inlineData: {
          data: params.fileBase64,
          mimeType: params.mimeType,
        },
      });
    }
    contents.push(params.prompt);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              params.timeoutErrorMessage ||
                'Timeout de 30 segundos en Gemini API alcanzado',
            ),
          ),
        30000,
      ),
    );

    const apiCallPromise = (async () => {
      const result = await ai.models.generateContent({
        model: modelName,
        contents,
        config: params.jsonResponse
          ? { responseMimeType: 'application/json' }
          : undefined,
      });
      const text = result.text;
      if (!text && !params.allowEmpty) {
        throw new Error('Respuesta vacía recibida de Gemini API.');
      }
      return text || '';
    })();

    return Promise.race([apiCallPromise, timeoutPromise]);
  }

  /**
   * Cliente reutilizable de OpenRouter. Mismo contrato multimodal que Gemini.
   */
  private async invokeOpenRouter(params: {
    prompt: string;
    fileBase64?: string;
    mimeType?: string;
    jsonResponse?: boolean;
    allowEmpty?: boolean;
    logLabel?: string;
  }): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY no configurado en el entorno.');
    }

    const modelName =
      process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini';
    this.logger.log(
      `Llamando a OpenRouter${params.logLabel ? ` para ${params.logLabel}` : ''} usando el modelo: ${modelName}...`,
    );

    const contents: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [{ type: 'text', text: params.prompt }];

    if (params.fileBase64 && params.mimeType) {
      contents.push({
        type: 'image_url',
        image_url: {
          url: `data:${params.mimeType};base64,${params.fileBase64}`,
        },
      });
    }

    const body: Record<string, unknown> = {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: contents,
        },
      ],
    };
    if (params.jsonResponse) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://evalia.com',
          'X-Title': 'EvalIA',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `OpenRouter API respondió con estado ${response.status}: ${errText}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (!text && !params.allowEmpty) {
      throw new Error('Respuesta vacía de OpenRouter API.');
    }
    return text || '';
  }

  /**
   * Limpia posibles marcas de formato markdown si la IA ignora las instrucciones de formato limpio.
   */
  private cleanMarkdownJson(text: string): string {
    let clean = text.trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return clean.substring(firstBrace, lastBrace + 1).trim();
    }
    if (clean.includes('```')) {
      clean = clean.replace(/^```(?:json)?\s*/gim, '');
      clean = clean.replace(/```\s*$/gm, '');
    }
    return clean.trim();
  }
}

