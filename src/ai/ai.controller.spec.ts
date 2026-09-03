import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiResilienceService } from './ai-resilience.service';

describe('AI Metrics Controller (HTTP)', () => {
  let app: INestApplication;
  let resilienceService: AiResilienceService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [AiService, AiResilienceService],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    resilienceService = module.get<AiResilienceService>(AiResilienceService);
  });

  beforeEach(() => {
    resilienceService.resetMetrics();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/ai/metricas', () => {
    it('devuelve status 200 con la estructura estricta de métricas y timestamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/metricas')
        .expect(200);

      // Verificación estricta de claves en la raíz
      expect(Object.keys(response.body).sort()).toEqual(
        ['gemini', 'openRouter', 'ultimaActualizacion'].sort(),
      );

      // Verificación de claves internas
      expect(Object.keys(response.body.gemini).sort()).toEqual(
        ['llamadasExitosas', 'llamadasFallidas'].sort(),
      );
      expect(Object.keys(response.body.openRouter).sort()).toEqual(
        ['llamadasExitosas', 'llamadasFallidas'].sort(),
      );

      expect(response.body.gemini).toEqual({
        llamadasExitosas: 0,
        llamadasFallidas: 0,
      });
      expect(response.body.openRouter).toEqual({
        llamadasExitosas: 0,
        llamadasFallidas: 0,
      });
      expect(
        new Date(response.body.ultimaActualizacion).getTime(),
      ).not.toBeNaN();
    });

    it('refleja llamadas exitosas y fallidas con actualización de timestamp', async () => {
      // 1. Llamada exitosa con Gemini
      await resilienceService.callWithFallback({
        context: 'test-gemini',
        geminiCall: async () => 'ok',
        openRouterCall: async () => 'fallback',
      });

      // 2. Llamada donde Gemini falla y entra OpenRouter con éxito
      await resilienceService.callWithFallback({
        context: 'test-fallback',
        geminiCall: async () => {
          throw new Error('Gemini 429 Rate Limit');
        },
        openRouterCall: async () => 'openrouter-ok',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/metricas')
        .expect(200);

      expect(response.body.gemini).toEqual({
        llamadasExitosas: 1,
        llamadasFallidas: 1,
      });
      expect(response.body.openRouter).toEqual({
        llamadasExitosas: 1,
        llamadasFallidas: 0,
      });
    });
  });

  describe('GET /api/v1/ai/metrics (Alias para retrocompatibilidad)', () => {
    it('devuelve status 200 con la misma estructura exacta', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/metrics')
        .expect(200);

      expect(Object.keys(response.body).sort()).toEqual(
        ['gemini', 'openRouter', 'ultimaActualizacion'].sort(),
      );
    });
  });
});
