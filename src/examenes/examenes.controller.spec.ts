import { Test, TestingModule } from '@nestjs/testing';
import { ExamenesController } from './examenes.controller';
import { ExamenesService } from './examenes.service';
import { SimilitudService } from '../similitud/similitud.service';

describe('ExamenesController', () => {
  let controller: ExamenesController;

  const mockExamenesService = {
    generateExam: jest.fn(),
    regenerarPregunta: jest.fn(),
    getMetricasExamen: jest.fn(),
    getExamen: jest.fn(),
    updateExamen: jest.fn(),
    deleteExamen: jest.fn(),
    duplicarExamen: jest.fn(),
  };

  const mockSimilitudService = {
    analizarSimilitudExamen: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExamenesController],
      providers: [
        {
          provide: ExamenesService,
          useValue: mockExamenesService,
        },
        {
          provide: SimilitudService,
          useValue: mockSimilitudService,
        },
      ],
    }).compile();

    controller = module.get<ExamenesController>(ExamenesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/v1/examenes/:id/similitud', () => {
    it('debe llamar a SimilitudService.analizarSimilitudExamen con el ID del examen', async () => {
      const mockResultado = {
        examenId: 'ex-1',
        totalAlumnos: 2,
        totalPreguntasAnalizadas: 1,
        totalParesComparados: 1,
        alertas: [
          {
            preguntaId: 'p-1',
            enunciadoPregunta: 'Pregunta',
            alumnoAId: 'al-1',
            alumnoBId: 'al-2',
            similitud: 0.95,
            nivel: 'ALTA',
            fragmentoA: 'Texto A',
            fragmentoB: 'Texto B',
          },
        ],
        generadoEn: '2026-09-24T00:00:00.000Z',
      };

      mockSimilitudService.analizarSimilitudExamen.mockResolvedValue(mockResultado);

      const res = await controller.getSimilitudExamen('ex-1');

      expect(mockSimilitudService.analizarSimilitudExamen).toHaveBeenCalledWith('ex-1');
      expect(res).toEqual(mockResultado);
    });
  });
});
