import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExamenesService } from './examenes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import {
  TipoAjuste,
  NivelDificultad,
  FormatoDestino,
} from './dto/regenerar-pregunta.dto';

describe('ExamenesService - regenerarPregunta', () => {
  let service: ExamenesService;

  const mockPrismaService: any = {
    examen: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    pregunta: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    entrega: {
      deleteMany: jest.fn(),
    },
    correccion: {
      deleteMany: jest.fn(),
    },
    curso: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAiService = {
    generateExam: jest.fn(),
    regenerarPregunta: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamenesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<ExamenesService>(ExamenesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Validación de parámetros y excepciones', () => {
    it('debe lanzar BadRequestException si tipoAjuste es CAMBIO_DIFICULTAD y falta nivelDificultad', async () => {
      await expect(
        service.regenerarPregunta({
          preguntaId: 'p-1',
          tipoAjuste: TipoAjuste.CAMBIO_DIFICULTAD,
          parametros: {},
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.regenerarPregunta({
          preguntaId: 'p-1',
          tipoAjuste: TipoAjuste.CAMBIO_DIFICULTAD,
        }),
      ).rejects.toThrow(
        'Para el tipo de ajuste CAMBIO_DIFICULTAD debe especificar el parámetro nivelDificultad',
      );

      expect(mockPrismaService.pregunta.findUnique).not.toHaveBeenCalled();
      expect(mockAiService.regenerarPregunta).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si tipoAjuste es CAMBIO_FORMATO y falta formatoDestino', async () => {
      await expect(
        service.regenerarPregunta({
          preguntaId: 'p-1',
          tipoAjuste: TipoAjuste.CAMBIO_FORMATO,
          parametros: {},
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.regenerarPregunta({
          preguntaId: 'p-1',
          tipoAjuste: TipoAjuste.CAMBIO_FORMATO,
        }),
      ).rejects.toThrow(
        'Para el tipo de ajuste CAMBIO_FORMATO debe especificar el parámetro formatoDestino',
      );

      expect(mockPrismaService.pregunta.findUnique).not.toHaveBeenCalled();
      expect(mockAiService.regenerarPregunta).not.toHaveBeenCalled();
    });

    it('debe lanzar NotFoundException si la pregunta no existe en la base de datos', async () => {
      mockPrismaService.pregunta.findUnique.mockResolvedValue(null);

      await expect(
        service.regenerarPregunta({
          preguntaId: 'pregunta-inexistente',
          tipoAjuste: TipoAjuste.REFRASEO,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.regenerarPregunta({
          preguntaId: 'pregunta-inexistente',
          tipoAjuste: TipoAjuste.REFRASEO,
        }),
      ).rejects.toThrow('Pregunta con ID pregunta-inexistente no encontrada.');

      expect(mockAiService.regenerarPregunta).not.toHaveBeenCalled();
    });
  });

  describe('Flujos exitosos de regeneración', () => {
    it('debe procesar un REFRASEO exitoso devolviendo preguntaOriginal y sugerencia estructurada', async () => {
      mockPrismaService.pregunta.findUnique.mockResolvedValue({
        id: 'p-123',
        examenId: 'ex-456',
        enunciado: 'Calcular la derivada de f(x) = x^2.',
        respuestaEsperada: "f'(x) = 2x",
        puntajeMaximo: 5,
        criteriosIA: 'Aplicar la regla de potencias.',
        esEvaluacionVisual: false,
      });

      mockAiService.regenerarPregunta.mockResolvedValue({
        enunciado:
          'Determine la función derivada de la función cuadrática f(x) = x^2.',
        respuestaEsperada: "f'(x) = 2x utilizando la regla de la potencia.",
        esEvaluacionVisual: false,
      });

      const response = await service.regenerarPregunta({
        preguntaId: 'p-123',
        tipoAjuste: TipoAjuste.REFRASEO,
      });

      expect(mockPrismaService.pregunta.findUnique).toHaveBeenCalledWith({
        where: { id: 'p-123' },
      });

      expect(mockAiService.regenerarPregunta).toHaveBeenCalledWith(
        {
          enunciado: 'Calcular la derivada de f(x) = x^2.',
          respuestaEsperada: "f'(x) = 2x",
          puntajeMaximo: 5,
          criteriosIA: 'Aplicar la regla de potencias.',
          esEvaluacionVisual: false,
        },
        TipoAjuste.REFRASEO,
        undefined,
      );

      expect(response).toEqual({
        preguntaOriginal: {
          id: 'p-123',
          enunciado: 'Calcular la derivada de f(x) = x^2.',
          respuestaEsperada: "f'(x) = 2x",
          puntajeMaximo: 5,
        },
        sugerencia: {
          enunciado:
            'Determine la función derivada de la función cuadrática f(x) = x^2.',
          respuestaEsperada: "f'(x) = 2x utilizando la regla de la potencia.",
          esEvaluacionVisual: false,
        },
        tipoAjuste: TipoAjuste.REFRASEO,
        parametros: undefined,
      });
    });

    it('debe procesar un CAMBIO_DIFICULTAD exitoso pasando parámetros correspondientes', async () => {
      mockPrismaService.pregunta.findUnique.mockResolvedValue({
        id: 'p-456',
        examenId: 'ex-789',
        enunciado: 'Enunciado simple',
        respuestaEsperada: 'Respuesta simple',
        puntajeMaximo: 10,
        criteriosIA: null,
        esEvaluacionVisual: false,
      });

      mockAiService.regenerarPregunta.mockResolvedValue({
        enunciado: 'Enunciado avanzado y complejo con cálculo multivariable.',
        respuestaEsperada: '
