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

  const mockPrismaService = {
    examen: {
      findUnique: jest.fn(),
    },
    pregunta: {
      findUnique: jest.fn(),
    },
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
        respuestaEsperada: 'Respuesta con desarrollo paso a paso.',
        esEvaluacionVisual: false,
      });

      const response = await service.regenerarPregunta({
        preguntaId: 'p-456',
        tipoAjuste: TipoAjuste.CAMBIO_DIFICULTAD,
        parametros: {
          nivelDificultad: NivelDificultad.DIFICIL,
        },
      });

      expect(mockAiService.regenerarPregunta).toHaveBeenCalledWith(
        expect.objectContaining({
          enunciado: 'Enunciado simple',
        }),
        TipoAjuste.CAMBIO_DIFICULTAD,
        { nivelDificultad: NivelDificultad.DIFICIL },
      );

      expect(response.sugerencia.enunciado).toContain('multivariable');
      expect(response.tipoAjuste).toBe(TipoAjuste.CAMBIO_DIFICULTAD);
      expect(response.parametros).toEqual({
        nivelDificultad: NivelDificultad.DIFICIL,
      });
    });

    it('debe procesar un CAMBIO_FORMATO exitoso pasando formatoDestino', async () => {
      mockPrismaService.pregunta.findUnique.mockResolvedValue({
        id: 'p-789',
        examenId: 'ex-101',
        enunciado: 'Definir mitosis.',
        respuestaEsperada: 'División celular.',
        puntajeMaximo: 4,
        criteriosIA: null,
        esEvaluacionVisual: false,
      });

      mockAiService.regenerarPregunta.mockResolvedValue({
        enunciado:
          '¿Qué proceso celular da lugar a dos células hijas idénticas?\nA) Meiosis\nB) Mitosis\nC) Fagocitosis\nD) Apoptosis',
        respuestaEsperada: 'Opción B (Mitosis)',
        esEvaluacionVisual: false,
      });

      const response = await service.regenerarPregunta({
        preguntaId: 'p-789',
        tipoAjuste: TipoAjuste.CAMBIO_FORMATO,
        parametros: {
          formatoDestino: FormatoDestino.MULTIPLE_CHOICE,
        },
      });

      expect(mockAiService.regenerarPregunta).toHaveBeenCalledWith(
        expect.anything(),
        TipoAjuste.CAMBIO_FORMATO,
        { formatoDestino: FormatoDestino.MULTIPLE_CHOICE },
      );

      expect(response.sugerencia.enunciado).toContain('¿Qué proceso celular');
      expect(response.parametros?.formatoDestino).toBe(
        FormatoDestino.MULTIPLE_CHOICE,
      );
    });

    it('debe permitir regenerar preguntas temporales en memoria pasando preguntaData cuando no existen en BD', async () => {
      mockPrismaService.pregunta.findUnique.mockResolvedValue(null);

      mockAiService.regenerarPregunta.mockResolvedValue({
        enunciado: 'Consigna regenerada desde memoria.',
        respuestaEsperada: 'Respuesta modelo generada.',
        esEvaluacionVisual: false,
      });

      const response = await service.regenerarPregunta({
        preguntaId: 'q-temp-1',
        tipoAjuste: TipoAjuste.REFRASEO,
        preguntaData: {
          enunciado: 'Consigna temporal en memoria',
          respuestaEsperada: 'Respuesta temporal en memoria',
          puntajeMaximo: 5,
        },
      });

      expect(mockAiService.regenerarPregunta).toHaveBeenCalledWith(
        expect.objectContaining({
          enunciado: 'Consigna temporal en memoria',
          respuestaEsperada: 'Respuesta temporal en memoria',
        }),
        TipoAjuste.REFRASEO,
        undefined,
      );

      expect(response.sugerencia.enunciado).toBe('Consigna regenerada desde memoria.');
    });
  });

  describe('getMetricasExamen', () => {
    it('debe lanzar NotFoundException si el examen no existe', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(service.getMetricasExamen('no-existe')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getMetricasExamen('no-existe')).rejects.toThrow(
        'Examen con ID no-existe no encontrado.',
      );
    });

    it('debe retornar métricas con nulls cuando no hay entregas publicadas', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'ex-1',
        titulo: 'Examen Sin Entregas',
        curso: {
          alumnos: [
            { alumnoId: 'a-1' },
            { alumnoId: 'a-2' },
            { alumnoId: 'a-3' },
          ],
        },
        preguntas: [
          {
            id: 'p-1',
            enunciado: 'Pregunta 1',
            puntajeMaximo: 5,
          },
          {
            id: 'p-2',
            enunciado: 'Pregunta 2',
            puntajeMaximo: 5,
          },
        ],
        entregas: [
          {
            estado: 'PENDIENTE',
            alumnoId: 'a-1',
            correccion: null,
          },
          {
            estado: 'PROCESANDO',
            alumnoId: 'a-2',
            correccion: { notaFinal: 8, feedbackJSON: null },
          },
        ],
      });

      const result = await service.getMetricasExamen('ex-1');

      expect(result).toEqual({
        examenId: 'ex-1',
        titulo: 'Examen Sin Entregas',
        totalAlumnos: 3,
        entregasPublicadas: 0,
        notaPromedio: null,
        notaMaxima: null,
        notaMinima: null,
        porcentajeAprobacion: null,
        puntajeTotalExamen: 10,
        diagnosticoPorPregunta: [
          {
            preguntaId: 'p-1',
            enunciado: 'Pregunta 1',
            puntajeMaximo: 5,
            promedioObtenido: null,
            porcentajeAcierto: null,
            porcentajeError: null,
          },
          {
            preguntaId: 'p-2',
            enunciado: 'Pregunta 2',
            puntajeMaximo: 5,
            promedioObtenido: null,
            porcentajeAcierto: null,
            porcentajeError: null,
          },
        ],
      });
    });

    it('debe calcular correctamente el promedio, máxima, mínima y porcentaje de aprobación', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'ex-1',
        titulo: 'Examen de Matemáticas',
        curso: {
          alumnos: [
            { alumnoId: 'a-1' },
            { alumnoId: 'a-2' },
            { alumnoId: 'a-3' },
            { alumnoId: 'a-4' },
            { alumnoId: 'a-5' },
          ],
        },
        preguntas: [
          { id: 'p-1', enunciado: 'P1', puntajeMaximo: 5 },
          { id: 'p-2', enunciado: 'P2', puntajeMaximo: 5 },
        ],
        entregas: [
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-1',
            correccion: { notaFinal: 8, feedbackJSON: '[]' },
          },
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-2',
            correccion: { notaFinal: 4, feedbackJSON: '[]' },
          },
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-3',
            correccion: { notaFinal: 9, feedbackJSON: '[]' },
          },
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-4',
            correccion: { notaFinal: 7, feedbackJSON: '[]' },
          },
          {
            estado: 'PENDIENTE',
            alumnoId: 'a-5',
            correccion: { notaFinal: 10, feedbackJSON: '[]' },
          },
        ],
      });

      const result = await service.getMetricasExamen('ex-1');

      expect(result.examenId).toBe('ex-1');
      expect(result.totalAlumnos).toBe(5);
      expect(result.entregasPublicadas).toBe(4);
      expect(result.notaPromedio).toBe(7);
      expect(result.notaMaxima).toBe(9);
      expect(result.notaMinima).toBe(4);
      expect(result.porcentajeAprobacion).toBe(75);
      expect(result.puntajeTotalExamen).toBe(10);
    });

    it('debe calcular el diagnóstico por pregunta parseando feedbackJSON correctamente', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'ex-1',
        titulo: 'Examen Diagnóstico',
        curso: { alumnos: [{ alumnoId: 'a-1' }, { alumnoId: 'a-2' }] },
        preguntas: [
          { id: 'p-1', enunciado: 'Derivada de x^2', puntajeMaximo: 2.5 },
          { id: 'p-2', enunciado: 'Integral de 2x', puntajeMaximo: 7.5 },
        ],
        entregas: [
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-1',
            correccion: {
              notaFinal: 8,
              feedbackJSON: JSON.stringify([
                { preguntaId: 'p-1', puntajeObtenido: 2.0 },
                { preguntaId: 'p-2', puntajeObtenido: 6.0 },
              ]),
            },
          },
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-2',
            correccion: {
              notaFinal: 7,
              feedbackJSON: JSON.stringify([
                { preguntaId: 'p-1', puntajeObtenido: 1.6 },
                { preguntaId: 'p-2', puntajeObtenido: 5.4 },
              ]),
            },
          },
        ],
      });

      const result = await service.getMetricasExamen('ex-1');

      expect(result.diagnosticoPorPregunta).toEqual([
        {
          preguntaId: 'p-1',
          enunciado: 'Derivada de x^2',
          puntajeMaximo: 2.5,
          promedioObtenido: 1.8,
          porcentajeAcierto: 72,
          porcentajeError: 28,
        },
        {
          preguntaId: 'p-2',
          enunciado: 'Integral de 2x',
          puntajeMaximo: 7.5,
          promedioObtenido: 5.7,
          porcentajeAcierto: 76,
          porcentajeError: 24,
        },
      ]);
    });

    it('debe skipear silenciosamente preguntas sin datos en feedbackJSON', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'ex-1',
        titulo: 'Examen con Datos Faltantes',
        curso: { alumnos: [{ alumnoId: 'a-1' }, { alumnoId: 'a-2' }] },
        preguntas: [
          { id: 'p-1', enunciado: 'Pregunta con datos', puntajeMaximo: 5 },
          { id: 'p-2', enunciado: 'Pregunta sin datos', puntajeMaximo: 5 },
        ],
        entregas: [
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-1',
            correccion: {
              notaFinal: 5,
              feedbackJSON: 'JSON_INVALIDO_O_CORRUPTO',
            },
          },
          {
            estado: 'PUBLICADO',
            alumnoId: 'a-2',
            correccion: {
              notaFinal: 5,
              feedbackJSON: JSON.stringify([
                { preguntaId: 'p-1', puntajeObtenido: 4 },
              ]),
            },
          },
        ],
      });

      const result = await service.getMetricasExamen('ex-1');

      expect(result.diagnosticoPorPregunta).toEqual([
        {
          preguntaId: 'p-1',
          enunciado: 'Pregunta con datos',
          puntajeMaximo: 5,
          promedioObtenido: 4,
          porcentajeAcierto: 80,
          porcentajeError: 20,
        },
        {
          preguntaId: 'p-2',
          enunciado: 'Pregunta sin datos',
          puntajeMaximo: 5,
          promedioObtenido: null,
          porcentajeAcierto: null,
          porcentajeError: null,
        },
      ]);
    });
  });
});

