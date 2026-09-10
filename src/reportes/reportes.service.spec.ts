import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ReportesService } from './reportes.service';
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

  describe('Sanitización de nombres de archivo', () => {
    it('debe sanitizar caracteres con tildes, mayúsculas, espacios y caracteres raros', () => {
      const filename = service.sanitizeFilename(
        ['notas', 'Matemática Aplicada', '5° A / Mañana', '2026-09-01'],
        'csv',
      );
      expect(filename).toBe('notas-matematica_aplicada-5_a_manana-2026-09-01.csv');
    });

    it('debe ignorar valores nulos o vacíos', () => {
      const filename = service.sanitizeFilename(
        ['notas', 'Física', null, undefined, '', '2026'],
        'pdf',
      );
      expect(filename).toBe('notas-fisica-2026.pdf');
    });
  });

  describe('Reporte por Examen (getExamenReportData)', () => {
    it('debe lanzar NotFoundException si el examen no existe', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(service.getExamenReportData('examen-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getExamenReportData('examen-inexistente')).rejects.toThrow(
        'Examen con ID examen-inexistente no encontrado.',
      );
    });

    it('debe generar reporte correctamente para un examen sin entregas (caso vacío válido)', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'exam-1',
        titulo: 'Primer Parcial',
        fecha: new Date('2026-05-10T10:00:00.000Z'),
        curso: {
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
    });

    it('debe manejar entregas con estados mixtos (PUBLICADO, PENDIENTE, REQUIERE_REVISION) sin contar no publicadas como 0', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'exam-2',
        titulo: 'Segundo Parcial',
        fecha: new Date('2026-06-20T10:00:00.000Z'),
        curso: {
          materia: 'Matemática',
          division: 'A',
          anio: 5,
          anioLectivo: 2026,
        },
        entregas: [
          {
            id: 'ent-1',
            estado: 'PUBLICADO',
            alumno: { legajo: 'L-101', nombre: 'Juan', apellido: 'Pérez' },
            correccion: {
              notaFinal: 8.5,
              nivelConfianza: 'ALTO',
              fechaAprobacion: new Date('2026-06-22T14:30:00.000Z'),
            },
          },
          {
            id: 'ent-2',
            estado: 'REQUIERE_REVISION',
            alumno: { legajo: 'L-102', nombre: 'Ana', apellido: 'Gómez' },
            correccion: {
              notaFinal: null,
              notaIA: 7.0,
              nivelConfianza: 'MEDIO',
              fechaAprobacion: null,
            },
          },
          {
            id: 'ent-3',
            estado: 'PENDIENTE',
            alumno: { legajo: 'L-103', nombre: 'Carlos', apellido: 'López' },
            correccion: null,
          },
        ],
      });

      const report = await service.getExamenReportData('exam-2');

      expect(report.rows.length).toBe(3);

      // Ana Gómez (orden alfabético por apellido)
      const anaRow = report.rows.find((r) => r[0] === 'L-102');
      expect(anaRow).toBeDefined();
      expect(anaRow![1]).toBe('Ana');
      expect(anaRow![2]).toBe('Gómez');
      expect(anaRow![3]).toBe('Sin publicar'); // No debe ser 0 ni notaIA previa
      expect(anaRow![4]).toBe('MEDIO');
      expect(anaRow![5]).toBe('-');

      // Carlos López
      const carlosRow = report.rows.find((r) => r[0] === 'L-103');
      expect(carlosRow).toBeDefined();
      expect(carlosRow![3]).toBe('Sin publicar');
      expect(carlosRow![4]).toBe('-');
      expect(carlosRow![5]).toBe('-');

      // Juan Pérez
      const juanRow = report.rows.find((r) => r[0] === 'L-101');
      expect(juanRow).toBeDefined();
      expect(juanRow![3]).toBe(8.5);
      expect(juanRow![4]).toBe('ALTO');
      expect(juanRow![5]).toBe('2026-06-22');
    });
  });

  describe('Reporte por Curso (getCursoReportData)', () => {
    it('debe lanzar NotFoundException si el curso no existe', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue(null);

      await expect(service.getCursoReportData('curso-inexistente')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getCursoReportData('curso-inexistente')).rejects.toThrow(
        'Curso con ID curso-inexistente no encontrado.',
      );
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

      expect(report.headers).toEqual(['Legajo', 'Nombre', 'Apellido', 'Promedio']);
      expect(report.rows).toEqual([]);
    });

    it('debe calcular promedios solo sobre notas publicadas y devolver "Sin datos" si el alumno no tiene notas publicadas', async () => {
      mockPrismaService.curso.findUnique.mockResolvedValue({
        id: 'curso-1',
        materia: 'Física',
        division: 'A',
        anio: 5,
        anioLectivo: 2026,
        alumnos: [
          {
            alumno: {
              id: 'a1',
              legajo: 'L-001',
              nombre: 'Martín',
              apellido: 'Álvarez',
            },
          },
          {
            alumno: {
              id: 'a2',
              legajo: 'L-002',
              nombre: 'Lucía',
              apellido: 'Fernández',
            },
          },
          {
            alumno: {
              id: 'a3',
              legajo: 'L-003',
              nombre: 'Sofía',
              apellido: 'Zárate',
            },
          },
        ],
        examenes: [
          {
            id: 'e1',
            titulo: 'Parcial 1: Cinemática',
            fecha: new Date('2026-04-10T10:00:00Z'),
            entregas: [
              {
                alumnoId: 'a1',
                estado: 'PUBLICADO',
                correccion: { notaFinal: 8 },
              },
              {
                alumnoId: 'a2',
                estado: 'REQUIERE_REVISION',
                correccion: { notaFinal: null },
              },
              // a3 no tiene entrega en Parcial 1
            ],
          },
          {
            id: 'e2',
            titulo: 'Parcial 2: Dinámica',
            fecha: new Date('2026-06-15T10:00:00Z'),
            entregas: [
              {
                alumnoId: 'a1',
                estado: 'PUBLICADO',
                correccion: { notaFinal: 10 },
              },
              {
                alumnoId: 'a2',
                estado: 'PENDIENTE',
                correccion: null,
              },
              {
                alumnoId: 'a3',
                estado: 'PUBLICADO',
                correccion: { notaFinal: 7 },
              },
            ],
          },
        ],
      });

      const report = await service.getCursoReportData('curso-1');

      expect(report.headers).toEqual([
        'Legajo',
        'Nombre',
        'Apellido',
        'Parcial 1: Cinemática',
        'Parcial 2: Dinámica',
        'Promedio',
      ]);

      expect(report.rows.length).toBe(3);

      // 1. Martín Álvarez: Parcial 1: 8, Parcial 2: 10 -> Promedio: 9
      const martinRow = report.rows.find((r) => r[0] === 'L-001');
      expect(martinRow).toBeDefined();
      expect(martinRow![3]).toBe(8);
      expect(martinRow![4]).toBe(10);
      expect(martinRow![5]).toBe(9);

      // 2. Lucía Fernández: Parcial 1: Sin publicar, Parcial 2: Sin publicar -> Promedio: "Sin datos" (no NaN ni 0)
      const luciaRow = report.rows.find((r) => r[0] === 'L-002');
      expect(luciaRow).toBeDefined();
      expect(luciaRow![3]).toBe('Sin publicar');
      expect(luciaRow![4]).toBe('Sin publicar');
      expect(luciaRow![5]).toBe('Sin datos');

      // 3. Sofía Zárate: Parcial 1: Sin publicar, Parcial 2: 7 -> Promedio: 7 (solo sobre la única publicada)
      const sofiaRow = report.rows.find((r) => r[0] === 'L-003');
      expect(sofiaRow).toBeDefined();
      expect(sofiaRow![3]).toBe('Sin publicar');
      expect(sofiaRow![4]).toBe(7);
      expect(sofiaRow![5]).toBe(7);
    });
  });

  describe('Generación de archivos CSV y PDF', () => {
    beforeEach(() => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'exam-sample',
        titulo: 'Examen de Álgebra',
        fecha: new Date('2026-05-15T10:00:00Z'),
        curso: {
          materia: 'Álgebra',
          division: 'A',
          anio: 1,
          anioLectivo: 2026,
        },
        entregas: [
          {
            id: 'ent-1',
            estado: 'PUBLICADO',
            alumno: { legajo: 'L-500', nombre: 'Matías', apellido: 'Báez' },
            correccion: {
              notaFinal: 9.5,
              nivelConfianza: 'ALTO',
              fechaAprobacion: new Date('2026-05-18T10:00:00Z'),
            },
          },
        ],
      });

      mockPrismaService.curso.findUnique.mockResolvedValue({
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
      });
    });

    it('generateExamenCsv debe incluir el BOM UTF-8 (\uFEFF) al inicio del buffer', async () => {
      const result = await service.generateExamenCsv('exam-sample');

      expect(result.filename).toMatch(/\.csv$/);
      expect(result.buffer).toBeInstanceOf(Buffer);

      // Comprobar primeros 3 bytes correspondientes al BOM UTF-8 (EF BB BF)
      expect(result.buffer[0]).toBe(0xef);
      expect(result.buffer[1]).toBe(0xbb);
      expect(result.buffer[2]).toBe(0xbf);

      const text = result.buffer.toString('utf-8');
      expect(text).toContain('Matías');
      expect(text).toContain('Báez');
      expect(text).toContain('9.5');
    });

    it('generateCursoCsv debe generar el CSV con BOM y promedio correcto', async () => {
      const result = await service.generateCursoCsv('curso-sample');

      expect(result.filename).toMatch(/\.csv$/);
      expect(result.buffer[0]).toBe(0xef);
      expect(result.buffer[1]).toBe(0xbb);
      expect(result.buffer[2]).toBe(0xbf);

      const text = result.buffer.toString('utf-8');
      expect(text).toContain('Legajo,Nombre,Apellido,Examen de Álgebra,Promedio');
      expect(text).toContain('L-500,Matías,Báez,9.5,9.5');
    });

    it('generateExamenPdf debe generar un buffer PDF válido con cabecera %PDF', async () => {
      const result = await service.generateExamenPdf('exam-sample');

      expect(result.filename).toMatch(/\.pdf$/);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(100);

      const header = result.buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('generateCursoPdf debe generar un buffer PDF válido', async () => {
      const result = await service.generateCursoPdf('curso-sample');

      expect(result.filename).toMatch(/\.pdf$/);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(100);

      const header = result.buffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });
});
