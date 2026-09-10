import { Test, TestingModule } from '@nestjs/testing';
import {
  ReportesService,
  sanitizeFilenamePart,
  buildReportFilename,
} from './reportes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ReportesService', () => {
  let service: ReportesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    examen: {
      findUnique: jest.fn(),
    },
    curso: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportesService>(ReportesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Sanitización de nombres de archivo y headers', () => {
    it('sanitiza correctamente materias y divisiones con acentos, tildes y espacios ("Matemática Aplicada" y "División A")', () => {
      const sanitizedMateria = sanitizeFilenamePart('Matemática Aplicada');
      const sanitizedDivision = sanitizeFilenamePart('División A');

      expect(sanitizedMateria).toBe('matematica-aplicada');
      expect(sanitizedDivision).toBe('division-a');

      const filenameCsv = buildReportFilename(
        'Matemática Aplicada',
        'División A',
        '2026-09-01',
        'csv',
      );
      expect(filenameCsv).toBe(
        'notas-matematica-aplicada-division-a-2026-09-01.csv',
      );

      const filenamePdf = buildReportFilename(
        'Matemática Aplicada',
        'División A',
        new Date('2026-09-01T00:00:00Z'),
        'pdf',
      );
      expect(filenamePdf).toBe(
        'notas-matematica-aplicada-division-a-2026-09-01.pdf',
      );
    });

    it('maneja valores con eñes, caracteres especiales o vacíos', () => {
      expect(sanitizeFilenamePart('Diseño & Programación Web 2!')).toBe(
        'diseno-programacion-web-2',
      );
      expect(sanitizeFilenamePart('')).toBe('');
    });
  });

  describe('Reporte por Examen', () => {
    const mockExamenData = {
      id: 'exam-1',
      titulo: 'Parcial 1',
      fecha: new Date('2026-09-01T10:00:00Z'),
      curso: {
        id: 'curso-1',
        materia: 'Matemática Aplicada',
        division: 'División A',
        anio: 5,
        anioLectivo: 2026,
      },
      entregas: [
        {
          id: 'ent-1',
          estado: 'PUBLICADO',
          alumno: {
            id: 'a1',
            legajo: 'L-101',
            nombre: 'Juan',
            apellido: 'Pérez',
          },
          correccion: {
            notaFinal: 8.5,
            nivelConfianza: 'ALTO',
            fechaAprobacion: new Date('2026-09-02T12:00:00Z'),
          },
        },
        {
          id: 'ent-2',
          estado: 'PENDIENTE',
          alumno: {
            id: 'a2',
            legajo: 'L-102',
            nombre: 'Ana',
            apellido: 'Gómez',
          },
          correccion: null,
        },
        {
          id: 'ent-3',
          estado: 'REQUIERE_REVISION',
          alumno: {
            id: 'a3',
            legajo: 'L-103',
            nombre: 'Carlos',
            apellido: 'López',
          },
          correccion: {
            notaFinal: null,
            nivelConfianza: 'BAJO',
            fechaAprobacion: null,
          },
        },
      ],
    };

    it('retorna filas con notas publicadas y marca explícitamente "Sin publicar" en entregas no publicadas', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamenData);

      const result = await service.getExamenReportData('exam-1');

      expect(result.examen.titulo).toBe('Parcial 1');
      expect(result.filas).toHaveLength(3);

      // Entrega 1: PUBLICADO con nota 8.5
      expect(result.filas[0].legajo).toBe('L-101');
      expect(result.filas[0].notaFinal).toBe(8.5);
      expect(result.filas[0].nivelConfianza).toBe('ALTO');
      expect(result.filas[0].fechaAprobacion).toBe('2026-09-02');

      // Entrega 2: PENDIENTE sin corrección
      expect(result.filas[1].legajo).toBe('L-102');
      expect(result.filas[1].notaFinal).toBe('Sin publicar');
      expect(result.filas[1].nivelConfianza).toBe('Sin datos');
      expect(result.filas[1].fechaAprobacion).toBe('Sin publicar');

      // Entrega 3: REQUIERE_REVISION con corrección sin notaFinal
      expect(result.filas[2].legajo).toBe('L-103');
      expect(result.filas[2].notaFinal).toBe('Sin publicar');
      expect(result.filas[2].nivelConfianza).toBe('BAJO');
      expect(result.filas[2].fechaAprobacion).toBe('Sin publicar');
    });

    it('genera CSV para examen incluyendo BOM UTF-8 y sep=, al inicio del archivo', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamenData);

      const { filename, content } = await service.generateExamenCsv('exam-1');

      expect(filename).toBe(
        'notas-matematica-aplicada-division-a-2026-09-01.csv',
      );
      // Debe comenzar estrictamente con \uFEFFsep=,\n
      expect(content.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(content).toContain(
        'Legajo,Nombre,Apellido,Nota Final,Nivel Confianza,Fecha Aprobacion',
      );
      expect(content).toContain('L-101,Juan,Perez,8.5,ALTO,2026-09-02');
      expect(content).toContain(
        'L-102,Ana,Gomez,Sin publicar,Sin datos,Sin publicar',
      );
    });

    it('genera PDF binario para examen sin errores', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamenData);

      const { filename, buffer } = await service.generateExamenPdf('exam-1');

      expect(filename).toBe(
        'notas-matematica-aplicada-division-a-2026-09-01.pdf',
      );
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('lanza NotFoundException con mensaje exacto si el examen no existe', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(service.getExamenReportData('non-existent')).rejects.toThrow(
        new NotFoundException('Examen con ID non-existent no encontrado.'),
      );
    });

    it('genera reporte de examen vacío si no hay entregas sin arrojar error', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        ...mockExamenData,
        entregas: [],
      });

      const result = await service.getExamenReportData('exam-1');
      expect(result.filas).toEqual([]);

      const csv = await service.generateExamenCsv('exam-1');
      expect(csv.content.startsWith('\uFEFFsep=,\n')).toBe(true);

      const pdf = await service.generateExamenPdf('exam-1');
      expect(pdf.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Reporte por Curso', () => {
    const mockCursoData = {
      id: 'curso-1',
      materia: 'Matemática Aplicada',
      division: 'División A',
      anio: 5,
      anioLectivo: 2026,
      examenes: [
        {
          id: 'exam-1',
          titulo: 'Parcial 1',
          fecha: new Date('2026-05-10T10:00:00Z'),
          entregas: [
            {
              id: 'ent-1',
              alumnoId: 'a1',
              estado: 'PUBLICADO',
              correccion: { notaFinal: 8 },
            },
            {
              id: 'ent-2',
              alumnoId: 'a2',
              estado: 'PENDIENTE',
              correccion: null,
            },
          ],
        },
        {
          id: 'exam-2',
          titulo: 'Parcial 2',
          fecha: new Date('2026-07-15T10:00:00Z'),
          entregas: [
            {
              id: 'ent-3',
              alumnoId: 'a1',
              estado: 'PUBLICADO',
              correccion: { notaFinal: 10 },
            },
            {
              id: 'ent-4',
              alumnoId: 'a3',
              estado: 'PUBLICADO',
              correccion: { notaFinal: 7.5 },
            },
          ],
        },
      ],
      alumnos: [
        {
          alumno: {
            id: 'a1',
            legajo: 'L-101',
            nombre: 'Juan',
            apellido: 'Pérez',
          },
        },
        {
          alumno: {
            id: 'a2',
            legajo: 'L-102',
            nombre: 'Ana',
            apellido: 'Gómez',
          },
        },
        {
          alumno: {
            id: 'a3',
            legajo: 'L-103',
            nombre: 'Carlos',
            apellido: 'López',
          },
        },
      ],
    };

    it('calcula el promedio únicamente sobre notas publicadas y devuelve "Sin datos" si el alumno no tiene notas publicadas', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(mockCursoData);

      const result = await service.getCursoReportData('curso-1');

      expect(result.examenes).toHaveLength(2);
      expect(result.filas).toHaveLength(3);

      // Alumno 1 (Juan Pérez): Examen 1 = 8, Examen 2 = 10 -> Promedio = 9
      const filaJuan = result.filas.find((f) => f.legajo === 'L-101');
      expect(filaJuan?.notasPorExamen['exam-1']).toBe(8);
      expect(filaJuan?.notasPorExamen['exam-2']).toBe(10);
      expect(filaJuan?.promedio).toBe(9);

      // Alumno 2 (Ana Gómez): Examen 1 = PENDIENTE ('Sin publicar'), Examen 2 = Sin entrega ('Sin publicar') -> Promedio = 'Sin datos'
      const filaAna = result.filas.find((f) => f.legajo === 'L-102');
      expect(filaAna?.notasPorExamen['exam-1']).toBe('Sin publicar');
      expect(filaAna?.notasPorExamen['exam-2']).toBe('Sin publicar');
      expect(filaAna?.promedio).toBe('Sin datos');

      // Alumno 3 (Carlos López): Examen 1 = Sin entrega ('Sin publicar'), Examen 2 = 7.5 -> Promedio = 7.5
      const filaCarlos = result.filas.find((f) => f.legajo === 'L-103');
      expect(filaCarlos?.notasPorExamen['exam-1']).toBe('Sin publicar');
      expect(filaCarlos?.notasPorExamen['exam-2']).toBe(7.5);
      expect(filaCarlos?.promedio).toBe(7.5);
    });

    it('genera CSV para curso con BOM UTF-8 y sep=,', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(mockCursoData);

      const { content } = await service.generateCursoCsv('curso-1');

      expect(content.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(content).toContain(
        'Legajo,Nombre,Apellido,Parcial 1,Parcial 2,Promedio',
      );
      expect(content).toContain('L-101,Juan,Perez,8,10,9');
      expect(content).toContain(
        'L-102,Ana,Gomez,Sin publicar,Sin publicar,Sin datos',
      );
      expect(content).toContain('L-103,Carlos,Lopez,Sin publicar,7.5,7.5');
    });

    it('genera PDF apaisado para curso sin errores', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(mockCursoData);

      const { filename, buffer } = await service.generateCursoPdf('curso-1');

      expect(filename.startsWith('notas-matematica-aplicada-division-a-')).toBe(
        true,
      );
      expect(filename.endsWith('.pdf')).toBe(true);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('lanza NotFoundException con mensaje exacto si el curso no existe', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(null);

      await expect(service.getCursoReportData('non-existent')).rejects.toThrow(
        new NotFoundException('Curso con ID non-existent no encontrado.'),
      );
    });

    it('genera reporte de curso vacío si no hay alumnos o exámenes sin fallar', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue({
        ...mockCursoData,
        alumnos: [],
        examenes: [],
      });

      const result = await service.getCursoReportData('curso-1');
      expect(result.filas).toEqual([]);
      expect(result.examenes).toEqual([]);

      const csv = await service.generateCursoCsv('curso-1');
      expect(csv.content.startsWith('\uFEFFsep=,\n')).toBe(true);

      const pdf = await service.generateCursoPdf('curso-1');
      expect(pdf.buffer.length).toBeGreaterThan(0);
    });
  });
});
