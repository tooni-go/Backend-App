import { Test, TestingModule } from '@nestjs/testing';
import { ProfesorService } from './profesor.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ProfesorService', () => {
  let service: ProfesorService;

  const mockPrisma = {
    profesor: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfesorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProfesorService>(ProfesorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('retorna el profesor por ID si existe', async () => {
      const mockProf = { id: 'prof-123', nombre: 'Carlos', apellido: 'Gómez' };
      mockPrisma.profesor.findUnique.mockResolvedValue(mockProf);

      const result = await service.getProfile('prof-123');
      expect(result).toEqual(mockProf);
    });

    it('lanza NotFoundException si el profesor no existe', async () => {
      mockPrisma.profesor.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('actualiza el nombre y apellido del profesor', async () => {
      mockPrisma.profesor.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.profesor.update.mockResolvedValue({
        id: 'prof-1',
        nombre: 'Ana',
        apellido: 'Martínez',
      });

      const result = await service.updateProfile(
        {
          nombre: 'Ana',
          apellido: 'Martínez',
        },
        'prof-1',
      );

      expect(mockPrisma.profesor.update).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
        data: { nombre: 'Ana', apellido: 'Martínez' },
      });
      expect(result.nombre).toBe('Ana');
    });

    it('lanza NotFoundException si el profesor a actualizar no existe', async () => {
      mockPrisma.profesor.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile({ nombre: 'Ana' }, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
