import { Test, TestingModule } from '@nestjs/testing';
import {
  AiResilienceService,
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAYS_MS,
} from './ai-resilience.service';

describe('AiResilienceService - Reintentos con Exponential Backoff, Fallback, Clasificación y Timeouts', () => {
  let service: AiResilienceService;
  let sleepSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiResilienceService],
    }).compile();

    service = module.get<AiResilienceService>(AiResilienceService);
    service.resetMetrics();

    // Mockear sleep para que los tests de backoff no demoren tiempo real
    sleepSpy = jest.spyOn(service, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Clasificación Explícita de Fallos (classifyAiError)', () => {
    it('clasifica error 429 como RATE_LIMIT', () => {
      const error = new Error(
        'HTTP 429 Too Many Requests: Rate limit exceeded',
      );
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
      expect(classified.statusCode).toBe(429);
    });

    it('clasifica error 503 / 502 / 500 como SERVER_ERROR', () => {
      const error503 = new Error('503 Service Unavailable');
      const classified503 = service.classifyAiError(error503);
      expect(classified503.tipo).toBe('SERVER_ERROR');
      expect(classified503.statusCode).toBe(503);

      const error502 = new Error(
        'OpenRouter API respondió con estado 502: Bad Gateway',
      );
      const classified502 = service.classifyAiError(error502);
      expect(classified502.tipo).toBe('SERVER_ERROR');
      expect(classified502.statusCode).toBe(502);
    });

    it('clasifica errores de tiempo excedido como TIMEOUT', () => {
      const timeoutError = new Error(
        'Timeout de 35 segundos en Gemini API alcanzado',
      );
      const classified = service.classifyAiError(timeoutError);
      expect(classified.tipo).toBe('TIMEOUT');
      expect(classified.statusCode).toBe(408);
    });

    it('clasifica errores de autenticación (401/403) como AUTHENTICATION_ERROR', () => {
      const authError = new Error('Invalid API key provided (status 401)');
      const classified = service.classifyAiError(authError);
      expect(classified.tipo).toBe('AUTHENTICATION_ERROR');
      expect(classified.statusCode).toBe(401);
    });

    it('clasifica errores de esquema o JSON como VALIDATION_ERROR', () => {
      const valError = new Error(
        'El JSON generado no cumple con el esquema requerido',
      );
      const classified = service.classifyAiError(valError);
      expect(classified.tipo).toBe('VALIDATION_ERROR');
      expect(classified.statusCode).toBe(422);
    });

    it('clasifica error 400 como BAD_REQUEST', () => {
      const badReqError = new Error('HTTP 400 Bad Request: invalid argument');
      const classified = service.classifyAiError(badReqError);
      expect(classified.tipo).toBe('BAD_REQUEST');
      expect(classified.statusCode).toBe(400);
    });

    it('clasifica null o undefined como UNKNOWN', () => {
      const classified = service.classifyAiError(null);
      expect(classified.tipo).toBe('UNKNOWN');
      expect(classified.mensaje).toBe('Error desconocido');
    });
  });

  describe('Detección de Errores Transitorios (isTransientError)', () => {
    it('reconoce errores 429 y cuota agotada como transitorios', () => {
      expect(
        service.isTransientError(new Error('HTTP 429 Too Many Requests')),
      ).toBe(true);
      expect(
        service.isTransientError(
          new Error('Resource exhausted: quota exceeded'),
        ),
      ).toBe(true);
      expect(service.isTransientError({ status: 429, message: 'Rate limit' })).toBe(
        true,
      );
    });

    it('reconoce errores 503, 502, 504 y sobrecarga como transitorios', () => {
      expect(
        service.isTransientError(new Error('503 Service Unavailable')),
      ).toBe(true);
      expect(
        service.isTransientError(
          new Error('Model is overloaded. Please try again later.'),
        ),
      ).toBe(true);
      expect(
        service.isTransientError(
          new Error('Server temporarily unavailable due to high demand'),
        ),
      ).toBe(true);
      expect(
        service.isTransientError({ status: 503, message: 'Service Unavailable' }),
      ).toBe(true);
      expect(
        service.isTransientError({ status: 502, message: 'Bad Gateway' }),
      ).toBe(true);
    });

    it('reconoce errores de red y conexión como transitorios', () => {
      expect(
        service.isTransientError(new Error('fetch failed: ECONNRESET')),
      ).toBe(true);
      expect(
        service.isTransientError(new Error('ETIMEDOUT: Connection timed out')),
      ).toBe(true);
      expect(
        service.isTransientError(new Error('ENOTFOUND api.openrouter.ai')),
      ).toBe(true);
    });

    it('NO considera transitorios los errores 400, 401, 403 y 422', () => {
      expect(
        service.isTransientError(
          new Error('Invalid API key provided (status 401)'),
        ),
      ).toBe(false);
      expect(
        service.isTransientError(new Error('HTTP 403 Forbidden: access denied')),
      ).toBe(false);
      expect(
        service.isTransientError(new Error('HTTP 400 Bad Request')),
      ).toBe(false);
      expect(
        service.isTransientError(
          new Error('El JSON generado no cumple con el esquema requerido'),
        ),
      ).toBe(false);
      expect(
        service.isTransientError({ status: 401, message: 'Unauthorized' }),
      ).toBe(false);
    });

    it('retorna false para valores nulos o vacíos', () => {
      expect(service.isTransientError(null)).toBe(false);
      expect(service.isTransientError(undefined)).toBe(false);
    });
  });

  describe('Política de Reintentos con Exponential Backoff (executeWithRetry)', () => {
    it('retorna resultado en el 1.er intento sin realizar reintentos si la operación es exitosa', async () => {
      const operation = jest.fn().mockResolvedValue('Resultado directo');

      const result = await service.executeWithRetry(operation, {
        operationLabel: 'Test Op',
        context: 'test',
      });

      expect(result).toBe('Resultado directo');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });

    it('se recupera en el 2.do intento tras un error transitorio 429 esperando 1.5s (1500ms)', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 429 Too Many Requests'))
        .mockResolvedValueOnce('Recuperado en reintento 1');

      const result = await service.executeWithRetry(operation, {
        operationLabel: 'Gemini Test',
        context: 'test',
      });

      expect(result).toBe('Recuperado en reintento 1');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1500);
    });

    it('se recupera en el 3.er intento tras dos errores transitorios esperando 1.5s y luego 3.0s', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockRejectedValueOnce(new Error('HTTP 429 Rate limit'))
        .mockResolvedValueOnce('Recuperado en reintento 2');

      const result = await service.executeWithRetry(operation, {
        operationLabel: 'Gemini Test',
        context: 'test',
      });

      expect(result).toBe('Recuperado en reintento 2');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1500);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 3000);
    });

    it('lanza el error tras agotar el máximo de 2 reintentos (3 intentos en total) ante fallo transitorio persistente', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('503 Service Unavailable'));

      await expect(
        service.executeWithRetry(operation, {
          operationLabel: 'Gemini Test',
          context: 'test',
        }),
      ).rejects.toThrow('503 Service Unavailable');

      expect(operation).toHaveBeenCalledTimes(3);
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1500);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 3000);
    });

    it('NO reintenta ante errores no transitorios como 401 o 400 y falla de inmediato en el 1.er intento', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Invalid API key provided (status 401)'));

      await expect(
        service.executeWithRetry(operation, {
          operationLabel: 'Gemini Test',
          context: 'test',
        }),
      ).rejects.toThrow('Invalid API key provided (status 401)');

      expect(operation).toHaveBeenCalledTimes(1);
      expect(sleepSpy).not.toHaveBeenCalled();
    });
  });

  describe('Flujo de Fallback y Resiliencia Integrado (callWithFallback)', () => {
    it('retorna resultado de Gemini directamente si la llamada es exitosa', async () => {
      const geminiCall = jest
        .fn()
        .mockResolvedValue('Resultado exitoso de Gemini');
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

    it('se recupera en Gemini en el 2.do intento tras 429 sin necesidad de disparar fallback a OpenRouter', async () => {
      const logSpy = jest.spyOn(service, 'logFallbackEvent');

      const geminiCall = jest
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 429 Too Many Requests'))
        .mockResolvedValueOnce('Éxito en reintento de Gemini');
      const openRouterCall = jest.fn();

      const result = await service.callWithFallback({
        context: 'evaluacion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Éxito en reintento de Gemini');
      expect(geminiCall).toHaveBeenCalledTimes(2);
      expect(openRouterCall).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(1500);

      const metrics = service.getMetrics();
      expect(metrics.gemini.llamadasExitosas).toBe(1);
      expect(metrics.gemini.llamadasFallidas).toBe(0);
      expect(metrics.openRouter.llamadasExitosas).toBe(0);
    });

    it('activa fallback hacia OpenRouter tras agotar los 2 reintentos de Gemini ante error 429', async () => {
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
      // 1 intento inicial + 2 reintentos en Gemini = 3 llamadas
      expect(geminiCall).toHaveBeenCalledTimes(3);
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

    it('aplica reintentos también en OpenRouter si este responde 503 antes de tener éxito', async () => {
      const geminiCall = jest
        .fn()
        .mockRejectedValue(new Error('503 Service Unavailable'));
      const openRouterCall = jest
        .fn()
        .mockRejectedValueOnce(new Error('503 Service Unavailable'))
        .mockResolvedValueOnce('Éxito OpenRouter reintentado');

      const result = await service.callWithFallback({
        context: 'extraccion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Éxito OpenRouter reintentado');
      expect(geminiCall).toHaveBeenCalledTimes(3);
      expect(openRouterCall).toHaveBeenCalledTimes(2);

      const metrics = service.getMetrics();
      expect(metrics.gemini.llamadasFallidas).toBe(1);
      expect(metrics.openRouter.llamadasExitosas).toBe(1);
    });

    it('no reintenta ante error 401 en Gemini y pasa inmediatamente al fallback de OpenRouter', async () => {
      const geminiCall = jest
        .fn()
        .mockRejectedValue(new Error('Invalid API key provided (status 401)'));
      const openRouterCall = jest
        .fn()
        .mockResolvedValue('Resultado OpenRouter tras 401');

      const result = await service.callWithFallback({
        context: 'generacion',
        geminiCall,
        openRouterCall,
      });

      expect(result).toBe('Resultado OpenRouter tras 401');
      // Solo 1 llamada a Gemini (sin reintentos)
      expect(geminiCall).toHaveBeenCalledTimes(1);
      expect(openRouterCall).toHaveBeenCalledTimes(1);
    });

    it('lanza el error cuando ambos proveedores fallan tras agotar reintentos y registra ambos fallos', async () => {
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

      expect(geminiCall).toHaveBeenCalledTimes(3);
      expect(openRouterCall).toHaveBeenCalledTimes(3);

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

  describe('Timeout configurable (executeWithTimeout y getTimeoutMs)', () => {
    it('utiliza 35000ms por defecto si AI_TIMEOUT_MS no está definido', () => {
      delete process.env.AI_TIMEOUT_MS;
      expect(service.getTimeoutMs()).toBe(DEFAULT_AI_TIMEOUT_MS);
      expect(service.getTimeoutMs()).toBe(35000);
    });

    it('utiliza 35000ms si AI_TIMEOUT_MS tiene un valor inválido o no numérico', () => {
      process.env.AI_TIMEOUT_MS = 'invalido';
      expect(service.getTimeoutMs()).toBe(35000);
      process.env.AI_TIMEOUT_MS = '-1000';
      expect(service.getTimeoutMs()).toBe(35000);
      delete process.env.AI_TIMEOUT_MS;
    });

    it('utiliza el valor de AI_TIMEOUT_MS si está definido correctamente en el entorno', () => {
      process.env.AI_TIMEOUT_MS = '40000';
      expect(service.getTimeoutMs()).toBe(40000);
      delete process.env.AI_TIMEOUT_MS;
    });

    it('cancela por timeout si la operación excede el tiempo estipulado', async () => {
      const slowOp = () =>
        new Promise<string>((resolve) =>
          setTimeout(() => resolve('tarde'), 200),
        );

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
