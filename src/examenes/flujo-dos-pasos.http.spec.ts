import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DocumentosController } from '../documentos/documentos.controller';
import { DocumentosService } from '../documentos/documentos.service';
import { ExamenesController } from './examenes.controller';
import { ExamenesService } from './examenes.service';
import { AiService, GeneratedExam } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { createMinimalDocxBuffer } from '../documentos/test-helpers/create-minimal-docx';

describe('Flujo de Dos Pasos: Extracción y Generación de Examen (HTTP)', () => {
  let app: INestApplication;

  const mockGeneratedExam: GeneratedExam = {
    titulo: 'Examen de Historia Argentina',
    preguntas: [
      {
        enunciado:
          '¿Cuáles fueron las causas principales de la Revolución de Mayo?',
        respuestaEsperada:
          'La crisis de la monarquía española tras las invasiones napoleónicas, los antecedentes de las invasiones inglesas y el anhelo criollo de autogobierno.',
        puntajeMaximo: 5,
        criteriosIA:
          'Evaluar mención a la invasión napoleónica, invasiones inglesas y cabildo abierto.',
        esEvaluacionVisual: false,
      },
      {
        enunciado:
          'Explique la importancia de la Primera Junta de Gobierno creada el 25 de mayo de 1810.',
        respuestaEsperada:
          'Constituyó el primer gobierno patrio e inició el proceso formal de emancipación e independencia.',
        puntajeMaximo: 5,
        criteriosIA:
          'Evaluar mención al derrocamiento del virrey y formación de gobierno criollo.',
        esEvaluacionVisual: false,
      },
    ],
  };

  const mockAiService = {
    extractTextFromDocument: jest.fn(),
    generateExam: jest.fn().mockResolvedValue(mockGeneratedExam),
  };

  const mockPrismaService = {
    examen: {
      findUnique: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController, ExamenesController],
      providers: [
        DocumentosService,
        ExamenesService,
        {
          provide: AiService,
          useValue: mockAiService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalFilters(new MulterExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completa el flujo de dos pasos: extrae texto de un DOCX real y genera el examen estructurado a partir del texto revisado', async () => {
    // 1. PASO 1: Extracción de texto desde archivo .docx
    const docxPlainText =
      'Examen de Historia\nPregunta 1: Explique las causas de la Revolucion de Mayo.';
    const docxBuffer = createMinimalDocxBuffer(docxPlainText);

    const step1Response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', docxBuffer, {
        filename: 'consignas-historia.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(201);

    expect(step1Response.body).toHaveProperty('textoExtraido');
    expect(step1Response.body.fuenteTipo).toBe('docx');
    expect(step1Response.body.requiereRevision).toBe(false);
    expect(step1Response.body.textoExtraido).toContain('Examen de Historia');
    expect(step1Response.body.textoExtraido).toContain('Revolucion de Mayo');

    const { textoExtraido } = step1Response.body;

    // Simulación: el docente edita / revisa el texto antes de generar
    const textoRevisadoPorDocente = `${textoExtraido}\nInstrucción: Generar 2 preguntas de 5 puntos cada una.`;

    // 2. PASO 2: Generación del examen utilizando el texto revisado en POST /api/v1/examenes/generar
    const step2Response = await request(app.getHttpServer())
      .post('/api/v1/examenes/generar')
      .send({ texto: textoRevisadoPorDocente })
      .expect(201);

    // 3. Confirmar que el examen generado tiene la forma esperada (titulo, preguntas[])
    expect(step2Response.body).toEqual(mockGeneratedExam);
    expect(step2Response.body).toHaveProperty('titulo');
    expect(typeof step2Response.body.titulo).toBe('string');
    expect(Array.isArray(step2Response.body.preguntas)).toBe(true);
    expect(step2Response.body.preguntas.length).toBeGreaterThanOrEqual(1);

    for (const pregunta of step2Response.body.preguntas) {
      expect(pregunta).toHaveProperty('enunciado');
      expect(pregunta).toHaveProperty('respuestaEsperada');
      expect(pregunta).toHaveProperty('puntajeMaximo');
      expect(pregunta).toHaveProperty('criteriosIA');
      expect(pregunta).toHaveProperty('esEvaluacionVisual');
      expect(typeof pregunta.enunciado).toBe('string');
      expect(typeof pregunta.respuestaEsperada).toBe('string');
      expect(typeof pregunta.puntajeMaximo).toBe('number');
      expect(typeof pregunta.criteriosIA).toBe('string');
      expect(pregunta.criteriosIA.length).toBeGreaterThan(0);
      expect(typeof pregunta.esEvaluacionVisual).toBe('boolean');
    }

    // 4. Confirmar que AiService.generateExam recibió el texto directamente sin re-extracción de archivos
    expect(mockAiService.generateExam).toHaveBeenCalledTimes(1);
    expect(mockAiService.generateExam).toHaveBeenCalledWith({
      texto: textoRevisadoPorDocente,
      fileBuffer: undefined,
      mimeType: undefined,
    });
  });
});
