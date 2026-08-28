import { Test, TestingModule } from '@nestjs/testing';
import {
  AiService,
  GeneratedExamSchema,
  GeneratedQuestionSchema,
} from './ai.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('AiService - Carga Inteligente de Exámenes (generateExam & Guardrails)', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Zod Schema Guardrails (GeneratedExamSchema & GeneratedQuestionSchema)', () => {
    const validQuestion = {
      enunciado: '¿Qué es la fotosíntesis?',
      respuestaEsperada:
        'Proceso por el cual las plantas convierten dióxido de carbono y agua en glucosa y oxígeno.',
      puntajeMaximo: 10,
      criteriosIA:
        'Verificar mención a reactivos (CO2, H2O), productos (glucosa, O2) y rol de la luz solar.',
      esEvaluacionVisual: false,
    };

    it('acepta una pregunta con todos los campos válidos incluyendo criteriosIA', () => {
      const result = GeneratedQuestionSchema.safeParse(validQuestion);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.criteriosIA).toBe(validQuestion.criteriosIA);
        expect(result.data.puntajeMaximo).toBe(10);
      }
    });

    it('rechaza si criteriosIA está ausente', () => {
      const { criteriosIA: _, ...withoutCriterios } = validQuestion;
      const result = GeneratedQuestionSchema.safeParse(withoutCriterios);
      expect(result.success).toBe(false);
    });

    it('rechaza si criteriosIA es un string vacío', () => {
      const result = GeneratedQuestionSchema.safeParse({
        ...validQuestion,
        criteriosIA: '',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza si puntajeMaximo es negativo', () => {
      const result = GeneratedQuestionSchema.safeParse({
        ...validQuestion,
        puntajeMaximo: -5,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza si puntajeMaximo es cero', () => {
      const result = GeneratedQuestionSchema.safeParse({
        ...validQuestion,
        puntajeMaximo: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza si puntajeMaximo excede el límite de 100 (alucinación de IA)', () => {
      const result = GeneratedQuestionSchema.safeParse({
        ...validQuestion,
        puntajeMaximo: 5000,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza si puntajeMaximo es un string en vez de un número', () => {
      const result = GeneratedQuestionSchema.safeParse({
        ...validQuestion,
        puntajeMaximo: '10' as unknown as number,
      });
      expect(result.success).toBe(false);
    });

    it('acepta un examen completo válido', () => {
      const validExam = {
        titulo: 'Examen de Biología Celular',
        preguntas: [validQuestion],
      };
      const result = GeneratedExamSchema.safeParse(validExam);
      expect(result.success).toBe(true);
    });

    it('acepta un examen vacío { titulo: "", preguntas: [] } si el material no tiene sentido pedagógico', () => {
      const emptyValidExam = {
        titulo: '',
        preguntas: [],
      };
      const result = GeneratedExamSchema.safeParse(emptyValidExam);
      expect(result.success).toBe(true);
    });

    it('rechaza un examen con título pero sin preguntas', () => {
      const emptyExam = {
        titulo: 'Examen Vacío',
        preguntas: [],
      };
      const result = GeneratedExamSchema.safeParse(emptyExam);
      expect(result.success).toBe(false);
    });

    it('rechaza un examen sin título pero con preguntas', () => {
      const noTitleExam = {
        titulo: '',
        preguntas: [validQuestion],
      };
      const result = GeneratedExamSchema.safeParse(noTitleExam);
      expect(result.success).toBe(false);
    });
  });

  describe('generateExam - Flujo de ejecución y Resiliencia con Fallback', () => {
    const mockValidExam = {
      titulo: 'Examen de Física Clásica',
      preguntas: [
        {
          enunciado: 'Enuncie la segunda ley de Newton.',
          respuestaEsperada: 'F = m * a (la fuerza neta es igual a la masa por la aceleración).',
          puntajeMaximo: 10,
          criteriosIA:
            'Exigir fórmula F=m*a, definición de variables y unidades del SI.',
          esEvaluacionVisual: false,
        },
      ],
    };

    it('genera un examen exitosamente con Gemini incluyendo criteriosIA', async () => {
      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockResolvedValue(JSON.stringify(mockValidExam));
      const openRouterSpy = jest.spyOn(
        service as any,
        'callOpenRouterForExamGeneration',
      );

      const result = await service.generateExam({
        texto: 'Generar examen de 1 pregunta sobre segunda ley de Newton',
      });

      expect(result).toEqual(mockValidExam);
      expect(result.preguntas[0].criteriosIA).toBe(
        mockValidExam.preguntas[0].criteriosIA,
      );
      expect(openRouterSpy).not.toHaveBeenCalled();
    });

    it('devuelve un examen vacío { titulo: "", preguntas: [] } si la IA determina que el contenido carece de sentido pedagógico', async () => {
      const emptyPedagogicalExam = {
        titulo: '',
        preguntas: [],
      };

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockResolvedValue(JSON.stringify(emptyPedagogicalExam));

      const result = await service.generateExam({
        texto: 'asdf random characters 1234',
      });

      expect(result).toEqual({
        titulo: '',
        preguntas: [],
      });
    });

    it('activa fallback a OpenRouter si Gemini devuelve un JSON sin criteriosIA', async () => {
      const invalidGeminiExam = {
        titulo: 'Examen sin criterios',
        preguntas: [
          {
            enunciado: 'Pregunta sin criterios',
            respuestaEsperada: 'Respuesta modelo',
            puntajeMaximo: 10,
            // Falta criteriosIA
            esEvaluacionVisual: false,
          },
        ],
      };

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockResolvedValue(JSON.stringify(invalidGeminiExam));

      const openRouterSpy = jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockResolvedValue(JSON.stringify(mockValidExam));

      const result = await service.generateExam({
        texto: 'Generar examen de Física',
      });

      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockValidExam);
      expect(result.preguntas[0].criteriosIA).toBeDefined();
      expect(result.preguntas[0].criteriosIA.length).toBeGreaterThan(0);
    });

    it('activa fallback a OpenRouter si Gemini devuelve puntajeMaximo fuera de rango (ej. 5000)', async () => {
      const invalidGeminiExam = {
        titulo: 'Examen con puntaje exagerado',
        preguntas: [
          {
            enunciado: 'Pregunta',
            respuestaEsperada: 'Respuesta',
            puntajeMaximo: 5000,
            criteriosIA: 'Criterio válido',
            esEvaluacionVisual: false,
          },
        ],
      };

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockResolvedValue(JSON.stringify(invalidGeminiExam));

      const openRouterSpy = jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockResolvedValue(JSON.stringify(mockValidExam));

      const result = await service.generateExam({
        texto: 'Generar examen',
      });

      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockValidExam);
    });

    it('activa fallback a OpenRouter si Gemini lanza un error de red o timeout', async () => {
      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockRejectedValue(new Error('Timeout de 30 segundos en Gemini API alcanzado'));

      const openRouterSpy = jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockResolvedValue(JSON.stringify(mockValidExam));

      const result = await service.generateExam({
        texto: 'Generar examen',
      });

      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockValidExam);
    });

    it('lanza InternalServerErrorException si ambos proveedores de IA fallan', async () => {
      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockRejectedValue(new Error('Gemini Unavailable'));

      jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockRejectedValue(new Error('OpenRouter Unavailable'));

      await expect(
        service.generateExam({
          texto: 'Generar examen',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('lanza BadRequestException si no se envía texto ni archivo', async () => {
      await expect(service.generateExam({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException ante un tipo MIME no soportado', async () => {
      await expect(
        service.generateExam({
          fileBuffer: Buffer.from('audio'),
          mimeType: 'audio/mp3',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
