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

  describe('GET /api/v1/ai/model y GET /api/v1/ai/config', () => {
    it('GET /api/v1/ai/model devuelve status 200 con modeloActivo, origen, catálogo homologado y geminiPrincipal', async () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      process.env.GEMINI_MODEL = 'gemini-2.5-flash';

      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/model')
        .expect(200);

      expect(response.body).toHaveProperty('modeloActivo');
      expect(response.body).toHaveProperty('origen');
      expect(response.body).toHaveProperty('modelosDisponibles');
      expect(response.body).toHaveProperty('geminiPrincipal');
      expect(Array.isArray(response.body.modelosDisponibles)).toBe(true);
      expect(response.body.modelosDisponibles.length).toBeGreaterThan(0);

      expect(response.body.geminiPrincipal).toEqual({
        modelo: 'gemini-2.5-flash',
        configurado: true,
      });

      const primerModelo = response.body.modelosDisponibles[0];
      expect(primerModelo).toHaveProperty('id');
      expect(primerModelo).toHaveProperty('nombre');
      expect(primerModelo).toHaveProperty('proveedor');
      expect(primerModelo).toHaveProperty('descripcion');
      expect(primerModelo).toHaveProperty('esMultimodal');
      expect(typeof primerModelo.esMultimodal).toBe('boolean');
    });

    it('devuelve geminiPrincipal.configurado: false si GEMINI_API_KEY no está configurada o está vacía', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        const responseNoKey = await request(app.getHttpServer())
          .get('/api/v1/ai/model')
          .expect(200);

        expect(responseNoKey.body.geminiPrincipal.configurado).toBe(false);

        process.env.GEMINI_API_KEY = '   ';
        const responseEmptyKey = await request(app.getHttpServer())
          .get('/api/v1/ai/model')
          .expect(200);

        expect(responseEmptyKey.body.geminiPrincipal.configurado).toBe(false);
      } finally {
        if (originalKey !== undefined) {
          process.env.GEMINI_API_KEY = originalKey;
        } else {
          delete process.env.GEMINI_API_KEY;
        }
      }
    });

    it('GET /api/v1/ai/config devuelve status 200 con la misma estructura (alias)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/config')
        .expect(200);

      expect(response.body).toHaveProperty('modeloActivo');
      expect(response.body).toHaveProperty('modelosDisponibles');
      expect(response.body).toHaveProperty('geminiPrincipal');
    });
  });

  describe('PATCH /api/v1/ai/model', () => {
    it('actualiza el modelo con éxito cuando se envía un modelo homologado válido', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/ai/model')
        .send({ modelo: 'anthropic/claude-3.5-sonnet' })
        .expect(200);

      expect(response.body.modeloActivo).toBe('anthropic/claude-3.5-sonnet');
      expect(response.body.origen).toBe('memoria');

      // Verificar que un GET subsiguiente refleje el cambio
      const getResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/model')
        .expect(200);

      expect(getResponse.body.modeloActivo).toBe('anthropic/claude-3.5-sonnet');
      expect(getResponse.body.origen).toBe('memoria');
    });

    it('devuelve 400 Bad Request cuando el modelo no pertenece al catálogo homologado', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/ai/model')
        .send({ modelo: 'modelo-inexistente/gpt-99' })
        .expect(400);

      expect(response.body.message).toContain('no está dentro del catálogo');
    });

    it('devuelve 400 Bad Request cuando el body está vacío o el campo modelo no es string válido', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/ai/model')
        .send({})
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/v1/ai/model')
        .send({ modelo: '' })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/v1/ai/model')
        .send({ modelo: '   ' })
        .expect(400);
    });
  });
});
