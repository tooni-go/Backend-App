import { Test, TestingModule } from '@nestjs/testing';
import { AlumnosService } from './alumnos.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AlumnosService', () => {
  let service: AlumnosService;
  let prisma: PrismaService;

  const mockPrismaService = {
    alumno: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        { id: '1', nombre: 'Juan', apellido: 'Perez', legajo: 'L-101' },
      ]),
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: 'L-101',
      }),
      update: jest.fn().mockResolvedValue({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: 'L-102',
      }),
      delete: jest.fn().mockResolvedValue({ id: '1' }),
    },
    alumnoCurso: {
      upsert: jest.fn().mockResolvedValue({}),
    },
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
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAlumnos', () => {
    it('should return paginated list', async () => {
      const res = await service.getAlumnos('curso-1', 1, 10);
      expect(res.data).toEqual([{ id: '1', nombre: 'Juan Perez', legajo: 'L-101' }]);
      expect(res.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('getAlumno', () => {
    it('should return alumno if found', async () => {
      mockPrismaService.alumno.findUnique.mockResolvedValueOnce({
        id: '1',
        nombre: 'Juan',
        apellido: 'Perez',
        legajo: 'L-101',
      });
      const res = await service.getAlumno('1');
      expect(res).toEqual({ id: '1', nombre: 'Juan Perez', legajo: 'L-101' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.alumno.findUnique.mockResolvedValueOnce(null);
      await expect(service.getAlumno('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createAlumno', () => {
    it('should create alumno and associate with curso', async () => {
      mockPrismaService.alumno.findUnique.mockResolvedValueOnce(null);
      const res = await service.createAlumno({
        nombre: 'Juan Perez',
        legajo: 'L-101',
        cursoId: 'curso-1',
      });
      expect(res.nombre).toBe('Juan Perez');
      expect(mockPrismaService.alumnoCurso.upsert).toHaveBeenCalled();
    });
  });

  describe('deleteAlumno', () => {
    it('should return success true on deletion', async () => {
      mockPrismaService.alumno.delete.mockResolvedValueOnce({ id: '1' });
      const res = await service.deleteAlumno('1');
      expect(res).toEqual({ success: true });
    });
  });
});
