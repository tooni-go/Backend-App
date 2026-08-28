import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('GET /api/v1/ai/metrics (HTTP)', () => {
  let app: INestApplication;
  let aiService: AiService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [AiService],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    aiService = module.get<AiService>(AiService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve status 200 con la estructura de métricas de los proveedores', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/metrics')
      .expect(200);

    expect(response.body).toEqual({
      gemini: {
        intentos: expect.any(Number),
        exitos: expect.any(Number),
        fallos: expect.any(Number),
      },
      openrouter: {
        intentos: expect.any(Number),
        exitos: expect.any(Number),
        fallos: expect.any(Number),
      },
    });
  });

  it('refleja cambios en las métricas en tiempo real', async () => {
    // Simulamos un incremento en memoria
    (aiService as any).metrics.gemini.intentos += 5;
    (aiService as any).metrics.gemini.exitos += 4;
    (aiService as any).metrics.gemini.fallos += 1;
    (aiService as any).metrics.openrouter.intentos += 1;
    (aiService as any).metrics.openrouter.exitos += 1;

    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/metrics')
      .expect(200);

    expect(response.body.gemini.intentos).toBeGreaterThanOrEqual(5);
    expect(response.body.gemini.exitos).toBeGreaterThanOrEqual(4);
    expect(response.body.gemini.fallos).toBeGreaterThanOrEqual(1);
    expect(response.body.openrouter.intentos).toBeGreaterThanOrEqual(1);
    expect(response.body.openrouter.exitos).toBeGreaterThanOrEqual(1);
  });
});
