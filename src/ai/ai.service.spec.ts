import { Test, TestingModule } from '@nestjs/testing';
import { GoogleGenAI } from '@google/genai';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  AiService,
  GeneratedExamSchema,
  GeneratedQuestionSchema,
  RegenerarPreguntaInput,
  RegeneracionSugerenciaSchema,
} from './ai.service';
import { AiResilienceService } from './ai-resilience.service';

jest.mock('@google/genai');

describe('AiService - Carga Inteligente de Exámenes (generateExam & Guardrails)', () => {
  let service: AiService;
  let resilienceService: AiResilienceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService, AiResilienceService],
    }).compile();

    service = module.get<AiService>(AiService);
    resilienceService = module.get<AiResilienceService>(AiResilienceService);
    resilienceService.resetMetrics();
    jest.spyOn(resilienceService, 'sleep').mockResolvedValue(undefined);
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
          respuestaEsperada:
            'F = m * a (la fuerza neta es igual a la masa por la aceleración).',
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
        .mockRejectedValue(
          new Error('Timeout de 30 segundos en Gemini API alcanzado'),
        );

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

  describe('Fallback Structured Logging & Metrics Counter', () => {
    const mockExam = {
      titulo: 'Examen de Prueba',
      preguntas: [
        {
          enunciado: 'Pregunta 1',
          respuestaEsperada: 'Respuesta 1',
          puntajeMaximo: 10,
          criteriosIA: 'Criterio 1',
          esEvaluacionVisual: false,
        },
      ],
    };

    it('llama a logFallbackEvent exactamente una vez con el flujo correcto cuando Gemini falla y OpenRouter tiene éxito', async () => {
      const logFallbackSpy = jest.spyOn(resilienceService, 'logFallbackEvent');

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockRejectedValue(
          new Error('Timeout de 30 segundos en Gemini API alcanzado'),
        );

      jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockResolvedValue(JSON.stringify(mockExam));

      await service.generateExam({ texto: 'Consigna' });

      expect(logFallbackSpy).toHaveBeenCalledTimes(1);
      expect(logFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'gemini',
          proveedorActivado: 'openrouter',
          error: expect.any(Error),
        }),
      );
    });

    it('llama a logFallbackEvent dos veces (una por cada proveedor) cuando ambos fallan en generateExam', async () => {
      const logFallbackSpy = jest.spyOn(resilienceService, 'logFallbackEvent');

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockRejectedValue(
          new Error('Timeout de 30 segundos en Gemini API alcanzado'),
        );

      jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockRejectedValue(
          new Error('OpenRouter API respondió con estado 502: Bad Gateway'),
        );

      await expect(service.generateExam({ texto: 'Consigna' })).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(logFallbackSpy).toHaveBeenCalledTimes(2);
      expect(logFallbackSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'gemini',
          proveedorActivado: 'openrouter',
        }),
      );
      expect(logFallbackSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'openrouter',
          proveedorActivado: 'ninguno',
        }),
      );
    });

    it('registra métricas correctamente tras 3 llamadas exitosas a Gemini y 1 fallback a OpenRouter', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: JSON.stringify(mockExam),
      });

      (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockExam) } }],
        }),
      } as any);

      try {
        // 3 llamadas exitosas a Gemini
        await service.generateExam({ texto: 'Examen 1' });
        await service.generateExam({ texto: 'Examen 2' });
        await service.generateExam({ texto: 'Examen 3' });

        // 1 llamada que falla persistentemente en Gemini (agota los 2 reintentos) y va a OpenRouter con éxito
        mockGenerateContent
          .mockRejectedValueOnce(new Error('Gemini API 503 Service Unavailable'))
          .mockRejectedValueOnce(new Error('Gemini API 503 Service Unavailable'))
          .mockRejectedValueOnce(new Error('Gemini API 503 Service Unavailable'));

        await service.generateExam({ texto: 'Examen 4 (Fallback)' });

        const metrics = service.getMetrics();

        expect(metrics).toMatchObject({
          gemini: {
            llamadasExitosas: 3,
            llamadasFallidas: 1,
          },
          openRouter: {
            llamadasExitosas: 1,
            llamadasFallidas: 0,
          },
        });
        expect(metrics.ultimaActualizacion).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Gestión Dinámica de Modelo OpenRouter y Catálogo Homologado', () => {
    it('inicializa el modelo activo con el valor por defecto "openai/gpt-4o-mini" cuando process.env.OPENROUTER_MODEL no está definido', () => {
      const config = service.getOpenRouterConfig();
      expect(config.modeloActivo).toBe('openai/gpt-4o-mini');
      expect(config.origen).toBe('env_default');
      expect(config.modelosDisponibles.length).toBeGreaterThan(0);
      expect(config.geminiPrincipal).toBeDefined();
      expect(typeof config.geminiPrincipal.modelo).toBe('string');
      expect(typeof config.geminiPrincipal.configurado).toBe('boolean');
      expect(service.getActiveOpenRouterModel()).toBe('openai/gpt-4o-mini');
    });

    it('devuelve geminiPrincipal con el modelo de GEMINI_MODEL y configurado: true si GEMINI_API_KEY está presente', () => {
      const originalKey = process.env.GEMINI_API_KEY;
      const originalModel = process.env.GEMINI_MODEL;
      try {
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        process.env.GEMINI_MODEL = 'gemini-2.5-flash';

        const config = service.getOpenRouterConfig();
        expect(config.geminiPrincipal).toEqual({
          modelo: 'gemini-2.5-flash',
          configurado: true,
        });
      } finally {
        if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
        else delete process.env.GEMINI_API_KEY;
        if (originalModel !== undefined)
          process.env.GEMINI_MODEL = originalModel;
        else delete process.env.GEMINI_MODEL;
      }
    });

    it('devuelve geminiPrincipal con configurado: false y modelo default cuando GEMINI_API_KEY no está configurada', () => {
      const originalKey = process.env.GEMINI_API_KEY;
      const originalModel = process.env.GEMINI_MODEL;
      try {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_MODEL;

        const config = service.getOpenRouterConfig();
        expect(config.geminiPrincipal).toEqual({
          modelo: 'gemini-3.1-flash-lite',
          configurado: false,
        });
      } finally {
        if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
        else delete process.env.GEMINI_API_KEY;
        if (originalModel !== undefined)
          process.env.GEMINI_MODEL = originalModel;
        else delete process.env.GEMINI_MODEL;
      }
    });

    it('inicializa el modelo activo desde process.env.OPENROUTER_MODEL si está definido al instanciar', async () => {
      const originalEnv = process.env.OPENROUTER_MODEL;
      try {
        process.env.OPENROUTER_MODEL = 'anthropic/claude-3.5-sonnet';
        const customModule: TestingModule = await Test.createTestingModule({
          providers: [AiService, AiResilienceService],
        }).compile();
        const customService = customModule.get<AiService>(AiService);

        expect(customService.getActiveOpenRouterModel()).toBe(
          'anthropic/claude-3.5-sonnet',
        );
        expect(customService.getOpenRouterConfig().origen).toBe('env_default');
      } finally {
        if (originalEnv !== undefined) {
          process.env.OPENROUTER_MODEL = originalEnv;
        } else {
          delete process.env.OPENROUTER_MODEL;
        }
      }
    });

    it('actualiza correctamente el modelo activo con setActiveOpenRouterModel y marca origen en "memoria"', () => {
      const updatedConfig = service.setActiveOpenRouterModel(
        'anthropic/claude-3.5-sonnet',
      );

      expect(updatedConfig.modeloActivo).toBe('anthropic/claude-3.5-sonnet');
      expect(updatedConfig.origen).toBe('memoria');
      expect(service.getActiveOpenRouterModel()).toBe(
        'anthropic/claude-3.5-sonnet',
      );
    });

    it('permite cambiar a otros modelos homologados como google/gemini-2.0-flash-001 o meta-llama/llama-3.3-70b-instruct', () => {
      service.setActiveOpenRouterModel('meta-llama/llama-3.3-70b-instruct');
      expect(service.getActiveOpenRouterModel()).toBe(
        'meta-llama/llama-3.3-70b-instruct',
      );

      service.setActiveOpenRouterModel('google/gemini-2.0-flash-001');
      expect(service.getActiveOpenRouterModel()).toBe(
        'google/gemini-2.0-flash-001',
      );
    });

    it('rechaza modelos no homologados lanzando BadRequestException con mensaje descriptivo', () => {
      expect(() =>
        service.setActiveOpenRouterModel('modelo-no-existente/xyz'),
      ).toThrow(BadRequestException);

      try {
        service.setActiveOpenRouterModel('modelo-invalido');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('no está dentro del catálogo');
      }
    });

    it('rechaza modelos vacíos o no válidos con BadRequestException', () => {
      expect(() => service.setActiveOpenRouterModel('')).toThrow(
        BadRequestException,
      );
      expect(() => service.setActiveOpenRouterModel('   ')).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.setActiveOpenRouterModel(null as unknown as string),
      ).toThrow(BadRequestException);
    });

    it('utiliza el modelo dinámicamente configurado en el payload HTTP enviado a OpenRouter al ocurrir fallback', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      // Cambiar dinámicamente el modelo a Claude 3.5 Sonnet
      service.setActiveOpenRouterModel('anthropic/claude-3.5-sonnet');

      const mockGenerateContent = jest
        .fn()
        .mockRejectedValue(new Error('Gemini Unavailable'));

      (GoogleGenAI as unknown as jest.Mock).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent,
        },
      }));

      const mockExamResponse = {
        titulo: 'Examen de Prueba Dinámico',
        preguntas: [
          {
            enunciado: 'Consigna',
            respuestaEsperada: 'Respuesta',
            puntajeMaximo: 10,
            criteriosIA: 'Criterio',
            esEvaluacionVisual: false,
          },
        ],
      };

      let capturedRequestBody: any = null;
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockImplementation(async (url: string, init: any) => {
          capturedRequestBody = JSON.parse(init.body);
          return {
            ok: true,
            json: async () => ({
              choices: [
                { message: { content: JSON.stringify(mockExamResponse) } },
              ],
            }),
          };
        }) as any;

      try {
        await service.generateExam({ texto: 'Generar examen con fallback' });

        expect(capturedRequestBody).toBeDefined();
        expect(capturedRequestBody.model).toBe('anthropic/claude-3.5-sonnet');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('incluye modeloOpenRouter en el log estructurado de fallback', async () => {
      const logFallbackSpy = jest.spyOn(resilienceService, 'logFallbackEvent');
      service.setActiveOpenRouterModel('anthropic/claude-3.5-sonnet');

      jest
        .spyOn(service as any, 'callGeminiForExamGeneration')
        .mockRejectedValue(new Error('Timeout en Gemini'));

      jest
        .spyOn(service as any, 'callOpenRouterForExamGeneration')
        .mockResolvedValue(
          JSON.stringify({
            titulo: 'Test',
            preguntas: [
              {
                enunciado: 'P1',
                respuestaEsperada: 'R1',
                puntajeMaximo: 10,
                criteriosIA: 'C1',
                esEvaluacionVisual: false,
              },
            ],
          }),
        );

      await service.generateExam({ texto: 'Consigna' });

      expect(logFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'gemini',
          proveedorActivado: 'openrouter',
          modeloOpenRouter: 'anthropic/claude-3.5-sonnet',
        }),
      );
    });
  });
});

describe('AiService - regenerarPregunta', () => {
  let service: AiService;

  const mockPregunta: RegenerarPreguntaInput = {
    enunciado: '¿Cuál es la ley de Ohm y cuál es su fórmula?',
    respuestaEsperada: 'V = I * R. Relaciona voltaje, corriente y resistencia.',
    puntajeMaximo: 10,
    criteriosIA: 'Verificar la definición conceptual y las unidades de medida.',
    esEvaluacionVisual: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService, AiResilienceService],
    }).compile();

    service = module.get<AiService>(AiService);
    const resilience = module.get<AiResilienceService>(AiResilienceService);
    jest.spyOn(resilience, 'sleep').mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Schema Zod - RegeneracionSugerenciaSchema', () => {
    it('debe validar exitosamente un objeto con estructura correcta', () => {
      const valid = {
        enunciado: 'Explique la relación entre voltaje y corriente.',
        respuestaEsperada: 'V = I * R con unidades.',
        esEvaluacionVisual: false,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('debe rechazar si falta esEvaluacionVisual o es null', () => {
      const invalid = {
        enunciado: 'Pregunta de prueba',
        respuestaEsperada: 'Respuesta de prueba',
        esEvaluacionVisual: null,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('debe rechazar si enunciado o respuestaEsperada están vacíos', () => {
      const invalid = {
        enunciado: '',
        respuestaEsperada: 'Respuesta',
        esEvaluacionVisual: false,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('regenerarPregunta con Gemini y fallback a OpenRouter', () => {
    it('debe regenerar exitosamente con Gemini como proveedor principal', async () => {
      const mockGeminiResponse = JSON.stringify({
        enunciado:
          'Defina la ley de Ohm indicando la relación entre potencial, corriente y resistencia.',
        respuestaEsperada: 'V = I * R',
        esEvaluacionVisual: false,
      });

      const invokeGeminiSpy = jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(mockGeminiResponse);

      const invokeOpenRouterSpy = jest.spyOn(
        service as any,
        'invokeOpenRouter',
      );

      const result = await service.regenerarPregunta(mockPregunta, 'REFRASEO');

      expect(invokeGeminiSpy).toHaveBeenCalledTimes(1);
      expect(invokeOpenRouterSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        enunciado:
          'Defina la ley de Ohm indicando la relación entre potencial, corriente y resistencia.',
        respuestaEsperada: 'V = I * R',
        esEvaluacionVisual: false,
      });
    });

    it('debe usar fallback a OpenRouter cuando Gemini falla', async () => {
      const mockOpenRouterResponse = JSON.stringify({
        enunciado:
          '¿Cuál de las siguientes fórmulas representa la ley de Ohm?\nA) V = I/R\nB) V = I * R\nC) I = V * R\nD) R = V * I',
        respuestaEsperada: 'Opción B (V = I * R)',
        esEvaluacionVisual: false,
      });

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockRejectedValue(new Error('Gemini API quota exceeded or timeout'));

      const invokeOpenRouterSpy = jest
        .spyOn(service as any, 'invokeOpenRouter')
        .mockResolvedValue(mockOpenRouterResponse);

      const result = await service.regenerarPregunta(
        mockPregunta,
        'CAMBIO_FORMATO',
        { formatoDestino: 'MULTIPLE_CHOICE' },
      );

      expect(invokeOpenRouterSpy).toHaveBeenCalledTimes(1);
      expect(result.enunciado).toContain('¿Cuál de las siguientes fórmulas');
      expect(result.respuestaEsperada).toBe('Opción B (V = I * R)');
      expect(result.esEvaluacionVisual).toBe(false);
    });

    it('debe lanzar InternalServerErrorException si la respuesta de la IA no cumple con el schema Zod', async () => {
      const mockMalformedResponse = JSON.stringify({
        enunciado: 'Solo enunciado sin respuesta ni esEvaluacionVisual',
      });

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(mockMalformedResponse);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(
        'La sugerencia generada por la IA no cumple con el formato estructurado requerido.',
      );
    });

    it('debe lanzar InternalServerErrorException si ambos proveedores (Gemini y OpenRouter) fallan', async () => {
      jest
        .spyOn(service as any, 'invokeGemini')
        .mockRejectedValue(new Error('Gemini error'));
      jest
        .spyOn(service as any, 'invokeOpenRouter')
        .mockRejectedValue(new Error('OpenRouter error'));

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(
        'No fue posible regenerar la pregunta con los servicios de IA disponibles.',
      );
    });

    it('debe limpiar bloques markdown en la respuesta antes de validar con Zod', async () => {
      const markdownJson = `\`\`\`json
{
  "enunciado": "Refraseo con markdown envolvente",
  "respuestaEsperada": "Respuesta correcta",
  "esEvaluacionVisual": false
}
\`\`\``;

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(markdownJson);

      const result = await service.regenerarPregunta(mockPregunta, 'REFRASEO');

      expect(result.enunciado).toBe('Refraseo con markdown envolvente');
    });
  });
});

describe('AiService - Validación Proactiva de Credenciales (onModuleInit & validateCredentials)', () => {
  let service: AiService;
  let originalGeminiKey: string | undefined;
  let originalOpenRouterKey: string | undefined;

  beforeEach(async () => {
    originalGeminiKey = process.env.GEMINI_API_KEY;
    originalOpenRouterKey = process.env.OPENROUTER_API_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService, AiResilienceService],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }

    if (originalOpenRouterKey !== undefined) {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }

    jest.restoreAllMocks();
  });

  it('valida exitosamente cuando ambas credenciales están configuradas', () => {
    process.env.GEMINI_API_KEY = 'gemini-key-valida';
    process.env.OPENROUTER_API_KEY = 'openrouter-key-valida';

    const loggerLogSpy = jest.spyOn((service as any).logger, 'log');

    const result = service.validateCredentials();

    expect(result).toEqual({
      geminiConfigured: true,
      openRouterConfigured: true,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Credenciales de IA validadas correctamente'),
    );
  });

  it('emite Logger.warn descriptivo cuando falta GEMINI_API_KEY', () => {
    delete process.env.GEMINI_API_KEY;
    process.env.OPENROUTER_API_KEY = 'openrouter-key-valida';

    const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

    const result = service.validateCredentials();

    expect(result).toEqual({
      geminiConfigured: false,
      openRouterConfigured: true,
    });
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GEMINI_API_KEY no está configurada'),
    );
  });

  it('emite Logger.warn descriptivo cuando falta OPENROUTER_API_KEY', () => {
    process.env.GEMINI_API_KEY = 'gemini-key-valida';
    delete process.env.OPENROUTER_API_KEY;

    const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

    const result = service.validateCredentials();

    expect(result).toEqual({
      geminiConfigured: true,
      openRouterConfigured: false,
    });
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('OPENROUTER_API_KEY no está configurada'),
    );
  });

  it('emite Logger.error de alerta crítica cuando faltan ambas credenciales sin lanzar excepciones', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const loggerErrorSpy = jest.spyOn((service as any).logger, 'error');

    expect(() => {
      const result = service.validateCredentials();
      expect(result).toEqual({
        geminiConfigured: false,
        openRouterConfigured: false,
      });
    }).not.toThrow();

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('ALERTA CRÍTICA: Ninguna credencial de IA configurada'),
    );
  });

  it('onModuleInit ejecuta validateCredentials durante el ciclo de vida sin interrumpir el arranque', () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const validateSpy = jest.spyOn(service, 'validateCredentials');

    expect(() => service.onModuleInit()).not.toThrow();
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });
});

describe('AiService - Compatibilidad de PDFs en Modelos de OpenRouter (Fallback PDF Data-URL vs Extracción de Texto)', () => {
  let service: AiService;
  let originalOpenRouterKey: string | undefined;

  beforeEach(async () => {
    originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService, AiResilienceService],
    }).compile();

    service = module.get<AiService>(AiService);
    const resilience = module.get<AiResilienceService>(AiResilienceService);
    jest.spyOn(resilience, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalOpenRouterKey !== undefined) {
      process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    } else {
      delete process.env.OPENROUTER_API_KEY;
    }
    jest.restoreAllMocks();
  });

  describe('Detección de compatibilidad PDF (modelSupportsPdfDataUrl)', () => {
    it('retorna true para modelos con soporte nativo de PDF data-URL', () => {
      expect(
        (service as any).modelSupportsPdfDataUrl('anthropic/claude-3.5-sonnet'),
      ).toBe(true);
      expect(
        (service as any).modelSupportsPdfDataUrl('google/gemini-2.0-flash-001'),
      ).toBe(true);
    });

    it('retorna false para modelos sin soporte nativo de PDF data-URL o de solo texto', () => {
      expect(
        (service as any).modelSupportsPdfDataUrl('openai/gpt-4o-mini'),
      ).toBe(false);
      expect(
        (service as any).modelSupportsPdfDataUrl(
          'meta-llama/llama-3.3-70b-instruct',
        ),
      ).toBe(false);
    });

    it('retorna false de forma segura para modelos no catalogados o strings vacíos', () => {
      expect((service as any).modelSupportsPdfDataUrl('modelo-desconocido')).toBe(
        false,
      );
      expect((service as any).modelSupportsPdfDataUrl('')).toBe(false);
      expect(
        (service as any).modelSupportsPdfDataUrl(null as unknown as string),
      ).toBe(false);
    });
  });

  describe('Extracción de texto local de PDF (extractPdfTextFallback)', () => {
    it('retorna el texto extraído correctamente cuando el parser procesa el buffer', async () => {
      const mockBuffer = Buffer.from('%PDF-1.4 Mock content');
      jest
        .spyOn(service as any, 'extractPdfTextFallback')
        .mockResolvedValue('Texto extraído del documento PDF');

      const result = await (service as any).extractPdfTextFallback(mockBuffer);
      expect(result).toBe('Texto extraído del documento PDF');
    });

    it('retorna cadena vacía sin lanzar excepciones si el parser falla o arroja un error', async () => {
      const corruptedBuffer = Buffer.from('archivo corrupto no pdf');
      const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

      // Ejecutar la implementación real con buffer inválido
      const result = await (service as any).extractPdfTextFallback(
        corruptedBuffer,
      );
      expect(typeof result).toBe('string');
      expect(result).toBe('');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fallo al extraer texto del PDF con parser local'),
      );
    });
  });

  describe('Construcción de payload en invokeOpenRouterRaw según compatibilidad PDF', () => {
    it('convierte PDF a texto plano y NO envía image_url cuando el modelo es openai/gpt-4o-mini (incompatible)', async () => {
      // Configurar modelo activo en gpt-4o-mini (soportaPdfDataUrl: false)
      service.setActiveOpenRouterModel('openai/gpt-4o-mini');

      jest
        .spyOn(service as any, 'extractPdfTextFallback')
        .mockResolvedValue('Contenido transcrito del examen PDF');

      let capturedPayload: any = null;
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockImplementation(async (url: string, init: any) => {
          capturedPayload = JSON.parse(init.body);
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Respuesta OK de OpenRouter' } }],
            }),
          };
        }) as any;

      try {
        const dummyPdfBase64 = Buffer.from('mock-pdf').toString('base64');
        const response = await (service as any).invokeOpenRouterRaw({
          prompt: 'Evaluar el siguiente examen adjunto:',
          fileBase64: dummyPdfBase64,
          mimeType: 'application/pdf',
        });

        expect(response).toBe('Respuesta OK de OpenRouter');
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload.model).toBe('openai/gpt-4o-mini');

        const messageContents = capturedPayload.messages[0].content;

        // Verificar que NUNCA contenga image_url con data:application/pdf
        const hasPdfImageUrl = messageContents.some(
          (c: any) =>
            c.type === 'image_url' &&
            c.image_url?.url?.includes('data:application/pdf'),
        );
        expect(hasPdfImageUrl).toBe(false);

        // Verificar que incluya el texto extraído en el prompt de texto
        const textContent = messageContents.find((c: any) => c.type === 'text');
        expect(textContent).toBeDefined();
        expect(textContent.text).toContain(
          '[CONTENIDO DEL DOCUMENTO PDF EXTRAÍDO]:',
        );
        expect(textContent.text).toContain('Contenido transcrito del examen PDF');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('envía image_url con data-URL cuando el modelo es anthropic/claude-3.5-sonnet (compatible con PDF)', async () => {
      // Configurar modelo activo en claude-3.5-sonnet (soportaPdfDataUrl: true)
      service.setActiveOpenRouterModel('anthropic/claude-3.5-sonnet');

      const extractSpy = jest.spyOn(service as any, 'extractPdfTextFallback');

      let capturedPayload: any = null;
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockImplementation(async (url: string, init: any) => {
          capturedPayload = JSON.parse(init.body);
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Respuesta OK de Claude' } }],
            }),
          };
        }) as any;

      try {
        const dummyPdfBase64 = Buffer.from('mock-pdf').toString('base64');
        const response = await (service as any).invokeOpenRouterRaw({
          prompt: 'Evaluar examen PDF:',
          fileBase64: dummyPdfBase64,
          mimeType: 'application/pdf',
        });

        expect(response).toBe('Respuesta OK de Claude');
        expect(capturedPayload).toBeDefined();
        expect(capturedPayload.model).toBe('anthropic/claude-3.5-sonnet');

        const messageContents = capturedPayload.messages[0].content;

        // No debe haber llamado al extractor local de texto
        expect(extractSpy).not.toHaveBeenCalled();

        // Debe contener image_url con el data-URL del PDF
        const pdfImageItem = messageContents.find(
          (c: any) =>
            c.type === 'image_url' &&
            c.image_url?.url === `data:application/pdf;base64,${dummyPdfBase64}`,
        );
        expect(pdfImageItem).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('mantiene el envío normal de imágenes como image_url independientemente del soporte de PDF', async () => {
      // Con gpt-4o-mini (soportaPdfDataUrl: false, pero esMultimodal: true para imágenes)
      service.setActiveOpenRouterModel('openai/gpt-4o-mini');

      let capturedPayload: any = null;
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockImplementation(async (url: string, init: any) => {
          capturedPayload = JSON.parse(init.body);
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: 'Respuesta OK de Imagen' } }],
            }),
          };
        }) as any;

      try {
        const dummyImgBase64 = Buffer.from('mock-image').toString('base64');
        await (service as any).invokeOpenRouterRaw({
          prompt: 'Evaluar foto del examen:',
          fileBase64: dummyImgBase64,
          mimeType: 'image/png',
        });

        const messageContents = capturedPayload.messages[0].content;
        const imgItem = messageContents.find(
          (c: any) =>
            c.type === 'image_url' &&
            c.image_url?.url === `data:image/png;base64,${dummyImgBase64}`,
        );
        expect(imgItem).toBeDefined();
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});