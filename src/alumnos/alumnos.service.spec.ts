import { Test, TestingModule } from '@nestjs/testing';
import { AlumnosService } from './alumnos.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AlumnosService', () => {
  let service: AlumnosService;

  const mockPrismaService: any = {
    curso: {
      findFirst: jest.fn().mockResolvedValue({ id: 'curso-1', profesorId: 'prof-1' }),
    },
    alumno: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: '1', nombre: 'Juan', apellido: 'Perez', legajo: '38123456' },
        ]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: '38123456',
      }),
      update: jest.fn().mockResolvedValue({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: '38123457',
      }),
      delete: jest.fn().mockResolvedValue({ id: '1' }),
    },
    alumnoCurso: {
      findMany: jest.fn().mockResolvedValue([{ alumnoId: '1', cursoId: 'curso-1' }]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    entrega: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    correccion: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlumnosService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AlumnosService>(AlumnosService);
    jest.clearAllMocks();
    mockPrismaService.curso.findFirst.mockResolvedValue({ id: 'curso-1', profesorId: 'prof-1' });
    mockPrismaService.alumno.count.mockResolvedValue(1);
    mockPrismaService.alumno.findMany.mockResolvedValue([
      { id: '1', nombre: 'Juan', apellido: 'Perez', legajo: '38123456' },
    ]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAlumnos', () => {
    it('should return paginated list', async () => {
      const res = await service.getAlumnos('prof-1', 'curso-1', 1, 10);
      expect(res.data).toEqual([
        { id: '1', nombre: 'Juan Perez', legajo: '38123456' },
      ]);
      expect(res.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('getAlumno', () => {
    it('should return alumno if found', async () => {
      mockPrismaService.alumno.findFirst.mockResolvedValueOnce({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: '38123456',
      });
      const res = await service.getAlumno('1', 'prof-1');
      expect(res).toEqual({
        id: '1',
        nombre: 'Juan Perez',
        legajo: '38123456',
      });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.alumno.findFirst.mockResolvedValueOnce(null);
      await expect(service.getAlumno('non-existent', 'prof-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAlumno', () => {
    it('should create alumno and associate with curso', async () => {
      mockPrismaService.alumno.findUnique.mockResolvedValueOnce(null);
      const res = await service.createAlumno({
        nombre: 'Juan Perez',
        legajo: '38123456',
        cursoId: 'curso-1',
      }, 'prof-1');
      expect(res.nombre).toBe('Juan Perez');
      expect(mockPrismaService.alumnoCurso.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteAlumno', () => {
    it('should return success true on smart deletion', async () => {
      mockPrismaService.alumnoCurso.findMany.mockResolvedValueOnce([{ alumnoId: '1', cursoId: 'curso-1' }]);
      mockPrismaService.alumnoCurso.count.mockResolvedValueOnce(0);
      mockPrismaService.entrega.findMany.mockResolvedValueOnce([]);
      const res = await service.deleteAlumno('1', 'prof-1');
      expect(res).toEqual({ success: true });
    });
  });
});
