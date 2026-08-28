import { Test, TestingModule } from '@nestjs/testing';
import {
  AiResilienceService,
  ClassifiedAiError,
} from './ai-resilience.service';

describe('AiResilienceService - Fallback, Clasificación de Errores y Métricas', () => {
  let service: AiResilienceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiResilienceService],
    }).compile();

    service = module.get<AiResilienceService>(AiResilienceService);
    service.resetMetrics();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Clasificación Explícita de Fallos (classifyAiError)', () => {
    it('clasifica error 429 como RATE_LIMIT', () => {
      const error = new Error('HTTP 429 Too Many Requests: Rate limit exceeded');
      const classified = service.classifyAiError(error);
      expect(classified.tipo).toBe('RATE_LIMIT');
      expect(classified.statusCode).toBe(429);
    });

    it('clasifica cuota agotada como QUOTA_EXCEEDED', () => {
      const error = new Error(
        'GoogleGenAIError: [429 RESOURCE_EXHAUSTED] Quota exceeded for quota metric',
      );
      const classified = service.classifyAiError(error);
      expect(classified.tipo).toBe('QUOTA_EXCEEDED');
    });

    it('clasifica error 503 / 502 / 500 como SERVER_ERROR', () => {
      const error503 = new Error('503 Service Unavailable');
      const classified503 = service.classifyAiError(error503);
      expect(classified503.tipo).toBe('SERVER_ERROR');

      const error502 = new Error('OpenRouter API respondió con estado 502: Bad Gateway');
      const classified502 = service.classifyAiError(error502);
      expect(classified502.tipo).toBe('SERVER_ERROR');
    });

    it('clasifica errores de tiempo excedido como TIMEOUT', () => {
      const timeoutError = new Error('Timeout de 30 segundos en Gemini API alcanzado');
      const classified = service.classifyAiError(timeoutError);
      expect(classified.tipo).toBe('TIMEOUT');
      expect(classified.statusCode).toBe(408);
    });

    it('clasifica errores de autenticación (401/403) como AUTHENTICATION_ERROR', () => {
      const authError = new Error('Invalid API key provided (status 401)');
      const classified = service.classifyAiError(authError);
      expect(classified.tipo).toBe('AUTHENTICATION_ERROR');
    });

    it('clasifica errores de esquema o JSON como VALIDATION_ERROR', () => {
      const valError = new Error('El JSON generado no cumple con el esquema requerido');
      const classified = service.classifyAiError(valError);
      expect(classified.tipo).toBe('VALIDATION_ERROR');
      expect(classified.statusCode).toBe(422);
    });
  });

  describe('Flujo de Fallback y Resiliencia (callWithFallback)', () => {
    it('retorna resultado de Gemini directamente si la llamada es exitosa', async () => {
      const geminiCall = jest.fn().mockResolvedValue('Resultado exitoso de Gemini');
      const openRouterCall = jest.fn();

      const result = await service.callWithFallback({
        context: 'generacion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Resultado exitoso de Gemini');
      expect(geminiCall).toHaveBeenCalledTimes(1);
      expect(openRouterCall).not.toHaveBeenCalled();

      const metrics = service.getMetrics();
      expect(metrics.gemini.llamadasExitosas).toBe(1);
      expect(metrics.gemini.llamadasFallidas).toBe(0);
      expect(metrics.openRouter.llamadasExitosas).toBe(0);
    });

    it('activa fallback hacia OpenRouter ante fallo 429 RATE_LIMIT de Gemini', async () => {
      const logSpy = jest.spyOn(service, 'logFallbackEvent');

      const geminiCall = jest
        .fn()
        .mockRejectedValue(new Error('HTTP 429 Too Many Requests'));
      const openRouterCall = jest
        .fn()
        .mockResolvedValue('Resultado exitoso de OpenRouter');

      const result = await service.callWithFallback({
        context: 'evaluacion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Resultado exitoso de OpenRouter');
      expect(geminiCall).toHaveBeenCalledTimes(1);
      expect(openRouterCall).toHaveBeenCalledTimes(1);

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          flujo: 'evaluacion',
          proveedorFallido: 'gemini',
          tipoFallo: 'RATE_LIMIT',
          proveedorActivado: 'openrouter',
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.gemini.llamadasExitosas).toBe(0);
      expect(metrics.gemini.llamadasFallidas).toBe(1);
      expect(metrics.openRouter.llamadasExitosas).toBe(1);
      expect(metrics.openRouter.llamadasFallidas).toBe(0);
    });

    it('activa fallback hacia OpenRouter ante fallo TIMEOUT de Gemini', async () => {
      const logSpy = jest.spyOn(service, 'logFallbackEvent');

      const geminiCall = jest
        .fn()
        .mockRejectedValue(
          new Error('Timeout de 30 segundos en Gemini API alcanzado'),
        );
      const openRouterCall = jest
        .fn()
        .mockResolvedValue('Texto extraído por OpenRouter');

      const result = await service.callWithFallback({
        context: 'extraccion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Texto extraído por OpenRouter');
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          flujo: 'extraccion',
          proveedorFallido: 'gemini',
          tipoFallo: 'TIMEOUT',
          proveedorActivado: 'openrouter',
        }),
      );
    });

    it('lanza el error cuando ambos proveedores fallan y registra ambos fallos', async () => {
      const logSpy = jest.spyOn(service, 'logFallbackEvent');

      const geminiCall = jest
        .fn()
        .mockRejectedValue(new Error('503 Service Unavailable'));
      const openRouterCall = jest
        .fn()
        .mockRejectedValue(
          new Error('OpenRouter API respondió con estado 502: Bad Gateway'),
        );

      await expect(
        service.callWithFallback({
          context: 'generacion',
          geminiCall,
          openRouterCall,
        }),
      ).rejects.toThrow('OpenRouter API respondió con estado 502: Bad Gateway');

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'gemini',
          tipoFallo: 'SERVER_ERROR',
          proveedorActivado: 'openrouter',
        }),
      );
      expect(logSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          flujo: 'generacion',
          proveedorFallido: 'openrouter',
          tipoFallo: 'SERVER_ERROR',
          proveedorActivado: 'ninguno',
        }),
      );

      const metrics = service.getMetrics();
      expect(metrics.gemini.llamadasFallidas).toBe(1);
      expect(metrics.openRouter.llamadasFallidas).toBe(1);
    });
  });

  describe('Timeout configurable (executeWithTimeout)', () => {
    it('utiliza 30000ms por defecto si AI_TIMEOUT_MS no está definido', () => {
      delete process.env.AI_TIMEOUT_MS;
      expect(service.getTimeoutMs()).toBe(30000);
    });

    it('utiliza el valor de AI_TIMEOUT_MS si está definido en el entorno', () => {
      process.env.AI_TIMEOUT_MS = '15000';
      expect(service.getTimeoutMs()).toBe(15000);
      delete process.env.AI_TIMEOUT_MS;
    });

    it('cancela por timeout si la operación excede el tiempo estipulado', async () => {
      const slowOp = () =>
        new Promise<string>((resolve) => setTimeout(() => resolve('tarde'), 200));

      await expect(
        service.executeWithTimeout(slowOp, 50, 'Prueba de Timeout'),
      ).rejects.toThrow('Timeout de 0 segundos en Prueba de Timeout alcanzado');
    });
  });

  describe('Estructura Estricta de Métricas (getMetrics)', () => {
    it('retorna exactamente las claves esperadas sin campos redundantes ni duplicados', () => {
      const metrics = service.getMetrics();

      // Verificar claves raíz exactas
      expect(Object.keys(metrics).sort()).toEqual(
        ['gemini', 'openRouter', 'ultimaActualizacion'].sort(),
      );

      // Verificar claves exactas de gemini
      expect(Object.keys(metrics.gemini).sort()).toEqual(
        ['llamadasExitosas', 'llamadasFallidas'].sort(),
      );

      // Verificar claves exactas de openRouter
      expect(Object.keys(metrics.openRouter).sort()).toEqual(
        ['llamadasExitosas', 'llamadasFallidas'].sort(),
      );

      // Confirmar que no existe la clave openrouter en minúscula
      expect((metrics as any).openrouter).toBeUndefined();
    });
  });
});
