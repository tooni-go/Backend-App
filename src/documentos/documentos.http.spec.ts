import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { AiService } from '../ai/ai.service';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import { createMinimalDocxBuffer } from './test-helpers/create-minimal-docx';

describe('POST /api/v1/documentos/extraer-texto (HTTP)', () => {
  let app: INestApplication;

  const mockAiService = {
    extractTextFromDocument: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [
        DocumentosService,
        {
          provide: AiService,
          useValue: mockAiService,
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

  it('extracts UTF-8 text from a TXT file without calling AI', async () => {
    const content = 'Consignas:\n1. Definir fotosíntesis.';

    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', Buffer.from(content, 'utf-8'), {
        filename: 'consignas.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(response.body).toEqual({
      textoExtraido: content,
      fuenteTipo: 'txt',
      requiereRevision: false,
    });
    expect(mockAiService.extractTextFromDocument).not.toHaveBeenCalled();
  });

  it('extracts text from a real DOCX with mammoth without calling AI', async () => {
    const expected =
      'Examen de Historia\nPregunta 1: Explique las causas de la Revolucion de Mayo.';
    const docxBuffer = createMinimalDocxBuffer(expected);

    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', docxBuffer, {
        filename: 'examen-historia.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .expect(201);

    expect(response.body.fuenteTipo).toBe('docx');
    expect(response.body.requiereRevision).toBe(false);
    expect(response.body.textoExtraido).toContain('Examen de Historia');
    expect(response.body.textoExtraido).toContain('Revolucion de Mayo');
    expect(mockAiService.extractTextFromDocument).not.toHaveBeenCalled();
  });

  it('transcribes PDF via AiService and marks requiereRevision', async () => {
    mockAiService.extractTextFromDocument.mockResolvedValue(
      'Temario de Física\n1. Principio de incertidumbre.',
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', Buffer.from('%PDF-1.4 fake'), {
        filename: 'temario.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(response.body).toEqual({
      textoExtraido: 'Temario de Física\n1. Principio de incertidumbre.',
      fuenteTipo: 'pdf',
      requiereRevision: true,
    });
  });

  it('transcribes an image via AiService', async () => {
    mockAiService.extractTextFromDocument.mockResolvedValue('x = 5');

    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', Buffer.from('fake-png'), {
        filename: 'hoja.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({
      textoExtraido: 'x = 5',
      fuenteTipo: 'imagen',
      requiereRevision: true,
    });
  });

  it('returns empty extracted text without fabricating content when AI finds nothing', async () => {
    mockAiService.extractTextFromDocument.mockResolvedValue('');

    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', Buffer.from('blank'), {
        filename: 'borrosa.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    expect(response.body).toEqual({
      textoExtraido: '',
      fuenteTipo: 'imagen',
      requiereRevision: true,
    });
  });

  it('rejects missing file with 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .expect(400);
  });

  it('rejects unsupported MIME types with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/documentos/extraer-texto')
      .attach('file', Buffer.from('audio'), {
        filename: 'audio.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(400);

    expect(JSON.stringify(response.body)).toMatch(/no soportado/i);
  });
});
