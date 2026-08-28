import { Test, TestingModule } from '@nestjs/testing';
import { EntregasService } from './entregas.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

describe('EntregasService - Creación, Corrección Asíncrona e Integración con AI', () => {
  let service: EntregasService;
  let prisma: PrismaService;
  let aiService: AiService;

  const mockPrismaService = {
    examen: {
      findUnique: jest.fn(),
    },
    alumno: {
      findUnique: jest.fn(),
    },
    entrega: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    correccion: {
      upsert: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockAiService = {
    evaluateSubmission: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntregasService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<EntregasService>(EntregasService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEntrega', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'entrega-alumno.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
      size: 1024,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('lanza BadRequestException si falta examId o alumnoId o file', async () => {
      await expect(
        service.createEntrega('', 'alumno-1', mockFile),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntrega('exam-1', '', mockFile),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createEntrega('exam-1', 'alumno-1', null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el tipo MIME no está soportado', async () => {
      const invalidFile = { ...mockFile, mimetype: 'audio/mp3' };
      await expect(
        service.createEntrega('exam-1', 'alumno-1', invalidFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si el examen o el alumno no existen', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createEntrega('exam-inexistente', 'alumno-1', mockFile),
      ).rejects.toThrow(NotFoundException);

      mockPrismaService.examen.findUnique.mockResolvedValueOnce({ id: 'exam-1' });
      mockPrismaService.alumno.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createEntrega('exam-1', 'alumno-inexistente', mockFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('crea la entrega en estado PENDIENTE y dispara el procesamiento en background', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({ id: 'exam-1' });
      mockPrismaService.alumno.findUnique.mockResolvedValue({ id: 'alumno-1' });
      mockPrismaService.entrega.create.mockResolvedValue({
        id: 'entrega-123',
        examenId: 'exam-1',
        alumnoId: 'alumno-1',
        estado: 'PENDIENTE',
        archivo: 'uploads/test.pdf',
      });

      const backgroundSpy = jest
        .spyOn(service as any, 'processCorrectionBackground')
        .mockResolvedValue(undefined);

      const result = await service.createEntrega('exam-1', 'alumno-1', mockFile);

      expect(result).toBeDefined();
      expect(result.id).toBe('entrega-123');
      expect(mockPrismaService.entrega.create).toHaveBeenCalledWith({
        data: {
          examenId: 'exam-1',
          alumnoId: 'alumno-1',
          archivo: expect.stringMatching(/^uploads\//),
          estado: 'PENDIENTE',
        },
      });
      expect(backgroundSpy).toHaveBeenCalledWith(
        'entrega-123',
        mockFile.buffer,
        mockFile.mimetype,
      );
    });
  });

  describe('processCorrectionBackground (Integración con AiService y AiResilienceService)', () => {
    const mockEntregaConExamen = {
      id: 'entrega-123',
      examen: {
        id: 'exam-1',
        preguntas: [
          {
            id: 'preg-1',
            enunciado: '¿Qué es la mitosis?',
            respuestaEsperada: 'División celular',
            puntajeMaximo: 10,
            criteriosIA: 'Mencionar fases',
            esEvaluacionVisual: false,
          },
        ],
      },
    };

    it('procesa corrección exitosa: cambia a PROCESANDO, llama a AiService, guarda corrección y actualiza a PENDIENTE_APROBACION', async () => {
      mockPrismaService.entrega.findUnique.mockResolvedValue(mockEntregaConExamen);
      mockPrismaService.entrega.update.mockResolvedValue({});
      mockPrismaService.correccion.upsert.mockResolvedValue({});

      const mockEvaluation = {
        preguntas: [
          {
            preguntaId: 'preg-1',
            textoDetectado: 'Es la división del núcleo celular',
            observaciones: 'Respuesta correcta y concisa',
            puntajeSugerido: 10,
          },
        ],
        notaIA: 10,
        nivelConfianza: 'ALTO',
      };

      mockAiService.evaluateSubmission.mockResolvedValue({
        evaluation: mockEvaluation,
        finalState: 'PENDIENTE_APROBACION',
      });

      await (service as any).processCorrectionBackground(
        'entrega-123',
        Buffer.from('pdf'),
        'application/pdf',
      );

      // 1. Estado cambia a PROCESANDO
      expect(mockPrismaService.entrega.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'entrega-123' },
        data: { estado: 'PROCESANDO' },
      });

      // 2. Llama a evaluateSubmission en AiService con los datos del examen
      expect(mockAiService.evaluateSubmission).toHaveBeenCalledWith(
        expect.any(Buffer),
        'application/pdf',
        [
          {
            id: 'preg-1',
            enunciado: '¿Qué es la mitosis?',
            respuestaEsperada: 'División celular',
            puntajeMaximo: 10,
            criteriosIA: 'Mencionar fases',
            esEvaluacionVisual: false,
          },
        ],
      );

      // 3. Guarda la corrección en la base de datos
      expect(mockPrismaService.correccion.upsert).toHaveBeenCalledWith({
        where: { entregaId: 'entrega-123' },
        create: {
          entregaId: 'entrega-123',
          notaIA: 10,
          nivelConfianza: 'ALTO',
          feedbackJSON: JSON.stringify(mockEvaluation),
        },
        update: {
          notaIA: 10,
          nivelConfianza: 'ALTO',
          feedbackJSON: JSON.stringify(mockEvaluation),
        },
      });

      // 4. Estado final se actualiza
      expect(mockPrismaService.entrega.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'entrega-123' },
        data: { estado: 'PENDIENTE_APROBACION' },
      });
    });

    it('asigna REQUIERE_REVISION si la corrección de IA falla o lanza un error catastrófico', async () => {
      mockPrismaService.entrega.findUnique.mockResolvedValue(mockEntregaConExamen);
      mockPrismaService.entrega.update.mockResolvedValue({});

      mockAiService.evaluateSubmission.mockRejectedValue(
        new Error('AI Service Unavailable'),
      );

      await (service as any).processCorrectionBackground(
        'entrega-123',
        Buffer.from('pdf'),
        'application/pdf',
      );

      expect(mockPrismaService.entrega.update).toHaveBeenLastCalledWith({
        where: { id: 'entrega-123' },
        data: { estado: 'REQUIERE_REVISION' },
      });
    });
  });

  describe('approveEntrega', () => {
    it('aprueba la entrega actualizando notaFinal y cambiando estado a PUBLICADO', async () => {
      mockPrismaService.entrega.findUnique.mockResolvedValue({
        id: 'entrega-123',
        correccion: { id: 'corr-1', feedbackJSON: '{}' },
      });
      mockPrismaService.correccion.update.mockResolvedValue({});
      mockPrismaService.entrega.update.mockResolvedValue({
        id: 'entrega-123',
        estado: 'PUBLICADO',
      });

      const result = await service.approveEntrega('entrega-123', 9, 'Excelente');

      expect(mockPrismaService.correccion.update).toHaveBeenCalledWith({
        where: { id: 'corr-1' },
        data: {
          notaFinal: 9,
          fechaAprobacion: expect.any(Date),
          feedbackJSON: JSON.stringify({ observacionesDocente: 'Excelente' }),
        },
      });
      expect(mockPrismaService.entrega.update).toHaveBeenCalledWith({
        where: { id: 'entrega-123' },
        data: { estado: 'PUBLICADO' },
        include: { correccion: true },
      });
      expect(result.estado).toBe('PUBLICADO');
    });
  });
});
