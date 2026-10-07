import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CursosService } from '../cursos/cursos.service';
import { ExamenesService } from '../examenes/examenes.service';
import { AlumnosService } from '../alumnos/alumnos.service';
import { EntregasService } from '../entregas/entregas.service';
import { ReportesService } from '../reportes/reportes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

describe('Seguridad y Aislamiento de Datos Multi-Docente (Tarea 1)', () => {
  let cursosService: CursosService;
  let examenesService: ExamenesService;
  let alumnosService: AlumnosService;
  let entregasService: EntregasService;
  let reportesService: ReportesService;

  const profesorA = 'profesor-a-id';
  const profesorB = 'profesor-b-id';

  const mockPrismaService: any = {
    curso: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    examen: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    alumno: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    alumnoCurso: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    entrega: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    correccion: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAiService: any = {
    generateExam: jest.fn(),
    regenerarPregunta: jest.fn(),
    evaluateSubmission: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CursosService,
        ExamenesService,
        AlumnosService,
        EntregasService,
        ReportesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    cursosService = module.get<CursosService>(CursosService);
    examenesService = module.get<ExamenesService>(ExamenesService);
    alumnosService = module.get<AlumnosService>(AlumnosService);
    entregasService = module.get<EntregasService>(EntregasService);
    reportesService = module.get<ReportesService>(ReportesService);

    jest.clearAllMocks();
  });

  describe('1. Aislamiento de Cursos', () => {
    it('Profesor B no puede ver un curso perteneciente al Profesor A (retorna 404)', async () => {
      mockPrismaService.curso.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'curso-a' && where.profesorId === profesorA) {
          return Promise.resolve({ id: 'curso-a', profesorId: profesorA });
        }
        return Promise.resolve(null);
      });

      // Profesor A sí puede acceder
      const curso = await cursosService.getCurso('curso-a', profesorA);
      expect(curso.id).toBe('curso-a');

      // Profesor B recibe 404
      await expect(cursosService.getCurso('curso-a', profesorB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Profesor B no puede editar ni eliminar un curso del Profesor A (retorna 404)', async () => {
      mockPrismaService.curso.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'curso-a' && where.profesorId === profesorA) {
          return Promise.resolve({ id: 'curso-a', profesorId: profesorA });
        }
        return Promise.resolve(null);
      });

      await expect(
        cursosService.updateCurso('curso-a', { materia: 'Hack' }, profesorB),
      ).rejects.toThrow(NotFoundException);

      await expect(
        cursosService.deleteCurso('curso-a', profesorB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Aislamiento de Exámenes', () => {
    it('Profesor B no puede acceder a los exámenes del Profesor A (retorna 404)', async () => {
      mockPrismaService.examen.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'examen-a' && where.curso?.profesorId === profesorA) {
          return Promise.resolve({ id: 'examen-a', cursoId: 'curso-a' });
        }
        return Promise.resolve(null);
      });

      const examen = await examenesService.getExamen('examen-a', profesorA);
      expect(examen.id).toBe('examen-a');

      await expect(
        examenesService.getExamen('examen-a', profesorB),
      ).rejects.toThrow(NotFoundException);
    });

    it('Profesor B no puede duplicar un examen del Profesor A ni duplicar a un curso ajeno (retorna 404)', async () => {
      mockPrismaService.examen.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'examen-a' && where.curso?.profesorId === profesorA) {
          return Promise.resolve({ id: 'examen-a', cursoId: 'curso-a', preguntas: [] });
        }
        return Promise.resolve(null);
      });

      await expect(
        examenesService.duplicarExamen('examen-a', { cursoDestinoId: 'curso-b' }, profesorB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Aislamiento de Alumnos y Eliminación Inteligente (Smart Unlink & Clean)', () => {
    it('getAlumnos filtra estrictamente los alumnos de cursos del profesor autenticado', async () => {
      mockPrismaService.alumno.count.mockResolvedValue(1);
      mockPrismaService.alumno.findMany.mockResolvedValue([
        { id: 'alumno-1', nombre: 'Lucas', apellido: 'Paz', legajo: 'L-1' },
      ]);

      await alumnosService.getAlumnos(profesorA);

      expect(mockPrismaService.alumno.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cursos: { some: { curso: { profesorId: profesorA } } } },
        }),
      );
    });

    it('Smart Unlink & Clean: desvincula alumno del curso del profesor pero preserva en BD si tiene otros cursos', async () => {
      // Alumno está en curso-A (Profesor A) y en curso-B (Profesor B)
      mockPrismaService.alumnoCurso.findMany.mockResolvedValueOnce([
        { alumnoId: 'alumno-compartido', cursoId: 'curso-a' },
      ]);
      // Queda 1 curso restante (curso-B)
      mockPrismaService.alumnoCurso.count.mockResolvedValueOnce(1);

      const res = await alumnosService.deleteAlumno('alumno-compartido', profesorA);

      expect(res).toEqual({ success: true });
      expect(mockPrismaService.alumnoCurso.deleteMany).toHaveBeenCalledWith({
        where: { alumnoId: 'alumno-compartido', curso: { profesorId: profesorA } },
      });
      // NO se debe borrar el registro de Alumno de la BD porque aún pertenece a otro curso
      expect(mockPrismaService.alumno.delete).not.toHaveBeenCalled();
    });

    it('Smart Unlink & Clean: si no le quedan otros cursos, elimina físicamente el registro del Alumno', async () => {
      mockPrismaService.alumnoCurso.findMany.mockResolvedValueOnce([
        { alumnoId: 'alumno-unico', cursoId: 'curso-b' },
      ]);
      // Quedan 0 cursos restantes
      mockPrismaService.alumnoCurso.count.mockResolvedValueOnce(0);
      mockPrismaService.entrega.findMany.mockResolvedValueOnce([]);

      const res = await alumnosService.deleteAlumno('alumno-unico', profesorB);

      expect(res).toEqual({ success: true });
      expect(mockPrismaService.alumnoCurso.deleteMany).toHaveBeenCalled();
      // SÍ se debe borrar el registro físico de Alumno
      expect(mockPrismaService.alumno.delete).toHaveBeenCalledWith({
        where: { id: 'alumno-unico' },
      });
    });
  });

  describe('4. Aislamiento de Entregas y Reportes', () => {
    it('Profesor B no puede ver ni aprobar una entrega del examen de Profesor A (retorna 404)', async () => {
      mockPrismaService.entrega.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'entrega-a' && where.examen?.curso?.profesorId === profesorA) {
          return Promise.resolve({ id: 'entrega-a', correccion: { id: 'c-1' } });
        }
        return Promise.resolve(null);
      });

      await expect(
        entregasService.getEntrega('entrega-a', profesorB),
      ).rejects.toThrow(NotFoundException);

      await expect(
        entregasService.approveEntrega('entrega-a', 10, 'Aprobado', profesorB),
      ).rejects.toThrow(NotFoundException);
    });

    it('Profesor B no puede descargar CSV ni PDF de un examen o curso del Profesor A (retorna 404)', async () => {
      mockPrismaService.examen.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'exam-a' && where.curso?.profesorId === profesorA) {
          return Promise.resolve({ id: 'exam-a', curso: { materia: 'Mat', division: 'A', anio: 1, anioLectivo: 2026 }, entregas: [] });
        }
        return Promise.resolve(null);
      });

      await expect(
        reportesService.generateExamenCsv('exam-a', profesorB),
      ).rejects.toThrow(NotFoundException);

      await expect(
        reportesService.generateExamenPdf('exam-a', profesorB),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
