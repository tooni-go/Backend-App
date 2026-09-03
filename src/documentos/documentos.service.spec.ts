import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { AiService } from '../ai/ai.service';
import * as mammoth from 'mammoth';

jest.mock('mammoth');

describe('DocumentosService', () => {
  let service: DocumentosService;

  const mockAiService = {
    extractTextFromDocument: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosService,
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<DocumentosService>(DocumentosService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Validation errors', () => {
    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.extractText(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when file buffer is missing', async () => {
      const file = {
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported mime types', async () => {
      const file = {
        mimetype: 'audio/mp3',
        buffer: Buffer.from('fake-audio'),
      } as Express.Multer.File;

      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when file size exceeds MAX_UPLOAD_SIZE_MB', async () => {
      const file = {
        mimetype: 'text/plain',
        buffer: Buffer.from('some text'),
        size: 20 * 1024 * 1024, // 20MB > 10MB default
      } as Express.Multer.File;

      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('TXT Extraction', () => {
    it('should extract text directly from buffer without invoking AI', async () => {
      const content =
        'Consignas del examen:\n1. Describir la fotosíntesis.\n2. Explicar el ciclo de Krebs.';
      const file = {
        mimetype: 'text/plain',
        buffer: Buffer.from(content, 'utf-8'),
        size: Buffer.byteLength(content),
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(result).toEqual({
        textoExtraido: content,
        fuenteTipo: 'txt',
        requiereRevision: false,
      });
      expect(mockAiService.extractTextFromDocument).not.toHaveBeenCalled();
    });

    it('should return empty textoExtraido and requiereRevision: true for an empty TXT', async () => {
      const file = {
        mimetype: 'text/plain',
        buffer: Buffer.from('   \n  ', 'utf-8'),
        size: 6,
        originalname: 'vacio.txt',
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(result).toEqual({
        textoExtraido: '',
        fuenteTipo: 'txt',
        requiereRevision: true,
      });
    });
  });

  describe('DOCX Extraction', () => {
    it('should extract text deterministically using mammoth without invoking AI', async () => {
      const docxText = 'Examen de Historia\nPregunta 1: La Revolución de Mayo.';
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: docxText,
      });

      const file = {
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('fake-docx-binary'),
        size: 100,
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(mammoth.extractRawText).toHaveBeenCalledWith({
        buffer: file.buffer,
      });
      expect(result).toEqual({
        textoExtraido: docxText,
        fuenteTipo: 'docx',
        requiereRevision: false,
      });
      expect(mockAiService.extractTextFromDocument).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when mammoth cannot read the DOCX', async () => {
      (mammoth.extractRawText as jest.Mock).mockRejectedValue(
        new Error('Invalid DOCX'),
      );

      const file = {
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('not-a-docx'),
        size: 10,
      } as Express.Multer.File;

      await expect(service.extractText(file)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockAiService.extractTextFromDocument).not.toHaveBeenCalled();
    });
  });

  describe('PDF Extraction', () => {
    it('should call AiService to transcribe PDF and mark requiereRevision: true', async () => {
      const pdfText =
        'Temario de Física Cuántica\n1. Principio de Incertidumbre de Heisenberg.';
      mockAiService.extractTextFromDocument.mockResolvedValue(pdfText);

      const file = {
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 ...'),
        size: 500,
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(mockAiService.extractTextFromDocument).toHaveBeenCalledWith(
        file.buffer,
        'application/pdf',
      );
      expect(result).toEqual({
        textoExtraido: pdfText,
        fuenteTipo: 'pdf',
        requiereRevision: true,
      });
    });
  });

  describe('Image Extraction', () => {
    it('should call AiService to transcribe JPG image and mark requiereRevision: true', async () => {
      const ocrText = 'Resolución manuscrita:\nx = 5, y = 10';
      mockAiService.extractTextFromDocument.mockResolvedValue(ocrText);

      const file = {
        mimetype: 'image/jpeg',
        buffer: Buffer.from('image-binary-data'),
        size: 1000,
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(mockAiService.extractTextFromDocument).toHaveBeenCalledWith(
        file.buffer,
        'image/jpeg',
      );
      expect(result).toEqual({
        textoExtraido: ocrText,
        fuenteTipo: 'imagen',
        requiereRevision: true,
      });
    });

    it('should return empty textoExtraido and requiereRevision: true if no text was found', async () => {
      mockAiService.extractTextFromDocument.mockResolvedValue('');

      const file = {
        mimetype: 'image/png',
        buffer: Buffer.from('blank-image-data'),
        size: 500,
      } as Express.Multer.File;

      const result = await service.extractText(file);

      expect(result).toEqual({
        textoExtraido: '',
        fuenteTipo: 'imagen',
        requiereRevision: true,
      });
    });
  });
});
