import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  ReportesService,
  sanitizeFilenamePart,
  buildReportFilename,
} from './reportes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportesService', () => {
  let service: ReportesService;

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
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportesService>(ReportesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Sanitización de nombres de archivo y helpers', () => {
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

    it('sanitizeFilename método debe sanitizar arreglos de componentes', () => {
      const filename = service.sanitizeFilename(
        ['notas', 'Matemática Aplicada', '5° A / Mañana', '2026-09-01'],
        'csv',
      );
      expect(filename).toBe(
        'notas-matematica_aplicada-5_a_manana-2026-09-01.csv',
      );
    });

    it('sanitizeFilename debe ignorar valores nulos o vacíos', () => {
      const filename = service.sanitizeFilename(
        ['notas', 'Física', null, undefined, '', '2026'],
        'pdf',
      );
      expect(filename).toBe('notas-fisica-2026.pdf');
    });
  });

  describe('Reporte por Examen (getExamenReportData)', () => {
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

    it('debe lanzar NotFoundException si el examen no existe', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(
        service.getExamenReportData('examen-inexistente'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getExamenReportData('examen-inexistente'),
      ).rejects.toThrow('Examen con ID examen-inexistente no encontrado.');
    });

    it('retorna filas con notas publicadas y marca explícitamente "Sin publicar" en entregas no publicadas', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(mockExamenData);

      const result = await service.getExamenReportData('exam-1');

      expect(result.examen.titulo).toBe('Parcial 1');
      expect(result.filas).toHaveLength(3);

      // Ana Gómez (orden alfabético por apellido)
      const ana = result.filas.find((f) => f.legajo === 'L-102');
      expect(ana?.notaFinal).toBe('Sin publicar');
      expect(ana?.fechaAprobacion).toBe('Sin publicar');

      // Juan Pérez
      const juan = result.filas.find((f) => f.legajo === 'L-101');
      expect(juan?.notaFinal).toBe(8.5);
      expect(juan?.nivelConfianza).toBe('ALTO');
      expect(juan?.fechaAprobacion).toBe('2026-09-02');

      // Carlos López
      const carlos = result.filas.find((f) => f.legajo === 'L-103');
      expect(carlos?.notaFinal).toBe('Sin publicar');
      expect(carlos?.nivelConfianza).toBe('BAJO');
      expect(carlos?.fechaAprobacion).toBe('Sin publicar');
    });

    it('debe generar reporte correctamente para un examen sin entregas (caso vacío válido)', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'exam-1',
        titulo: 'Primer Parcial',
        fecha: new Date('2026-05-10T10:00:00.000Z'),
        curso: {
          id: 'curso-1',
          materia: 'Química',
          division: 'B',
          anio: 4,
          anioLectivo: 2026,
        },
        entregas: [],
      });

      const report = await service.getExamenReportData('exam-1');

      expect(report.metadata.tituloExamen).toBe('Primer Parcial');
      expect(report.metadata.materia).toBe('Química');
      expect(report.headers).toEqual([
        'Legajo',
        'Nombre',
        'Apellido',
        'Nota Final',
        'Nivel de Confianza',
        'Fecha de Aprobación',
      ]);
      expect(report.rows).toEqual([]);
      expect(report.filas).toEqual([]);
    });
  });

  describe('Reporte por Curso (getCursoReportData)', () => {
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

    it('debe lanzar NotFoundException si el curso no existe', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(null);

      await expect(
        service.getCursoReportData('curso-inexistente'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getCursoReportData('curso-inexistente'),
      ).rejects.toThrow('Curso con ID curso-inexistente no encontrado.');
    });

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

    it('debe generar reporte vacío si el curso no tiene alumnos ni exámenes', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue({
        id: 'curso-vacio',
        materia: 'Historia',
        division: 'C',
        anio: 3,
        anioLectivo: 2026,
        alumnos: [],
        examenes: [],
      });

      const report = await service.getCursoReportData('curso-vacio');

      expect(report.headers).toEqual([
        'Legajo',
        'Nombre',
        'Apellido',
        'Promedio',
      ]);
      expect(report.rows).toEqual([]);
      expect(report.filas).toEqual([]);
      expect(report.examenes).toEqual([]);
    });
  });

  describe('Generación de archivos CSV y PDF', () => {
    const mockSampleExamen = {
      id: 'exam-sample',
      titulo: 'Examen de Álgebra',
      fecha: new Date('2026-05-15T10:00:00Z'),
      curso: {
        id: 'curso-sample',
        materia: 'Álgebra',
        division: 'A',
        anio: 1,
        anioLectivo: 2026,
      },
      entregas: [
        {
          id: 'ent-1',
          estado: 'PUBLICADO',
          alumno: {
            id: 'a1',
            legajo: 'L-500',
            nombre: 'Matías',
            apellido: 'Báez',
          },
          correccion: {
            notaFinal: 9.5,
            nivelConfianza: 'ALTO',
            fechaAprobacion: new Date('2026-05-18T10:00:00Z'),
          },
        },
      ],
    };

    const mockSampleCurso = {
      id: 'curso-sample',
      materia: 'Álgebra',
      division: 'A',
      anio: 1,
      anioLectivo: 2026,
      alumnos: [
        {
          alumno: {
            id: 'a1',
            legajo: 'L-500',
            nombre: 'Matías',
            apellido: 'Báez',
          },
        },
      ],
      examenes: [
        {
          id: 'exam-sample',
          titulo: 'Examen de Álgebra',
          fecha: new Date('2026-05-15T10:00:00Z'),
          entregas: [
            {
              alumnoId: 'a1',
              estado: 'PUBLICADO',
              correccion: { notaFinal: 9.5 },
            },
          ],
        },
      ],
    };

    beforeEach(() => {
      mockPrismaService.examen.findUnique.mockResolvedValue(mockSampleExamen);
      mockPrismaService.curso.findUnique.mockResolvedValue(mockSampleCurso);
    });

    it('generateExamenCsv debe incluir el BOM UTF-8 (\uFEFF) y sep=, al inicio del archivo', async () => {
      const result = await service.generateExamenCsv('exam-sample');

      expect(result.filename).toBe('notas-algebra-a-2026-05-15.csv');
      expect(result.buffer).toBeInstanceOf(Buffer);

      // Comprobar primeros 3 bytes correspondientes al BOM UTF-8 (EF BB BF)
      expect(result.buffer[0]).toBe(0xef);
      expect(result.buffer[1]).toBe(0xbb);
      expect(result.buffer[2]).toBe(0xbf);

      expect(result.content.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(result.content).toContain('L-500,Matias,Baez,9.5,ALTO,2026-05-18');
    });

    it('generateCursoCsv debe generar el CSV con BOM y promedio correcto', async () => {
      const result = await service.generateCursoCsv('curso-sample');

      expect(result.filename.startsWith('notas-algebra-a-')).toBe(true);
      expect(result.filename.endsWith('.csv')).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer[0]).toBe(0xef);
      expect(result.buffer[1]).toBe(0xbb);
      expect(result.buffer[2]).toBe(0xbf);

      expect(result.content.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(result.content).toContain(
        'Legajo,Nombre,Apellido,Examen de Algebra,Promedio',
      );
      expect(result.content).toContain('L-500,Matias,Baez,9.5,9.5');
    });

    it('generateExamenPdf debe generar un buffer PDF válido con cabecera %PDF', async () => {
      const result = await service.generateExamenPdf('exam-sample');

      expect(result.filename).toBe('notas-algebra-a-2026-05-15.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(100);

      const header = result.buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('generateCursoPdf debe generar un buffer PDF válido', async () => {
      const result = await service.generateCursoPdf('curso-sample');

      expect(result.filename.startsWith('notas-algebra-a-')).toBe(true);
      expect(result.filename.endsWith('.pdf')).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(100);

      const header = result.buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });
});
