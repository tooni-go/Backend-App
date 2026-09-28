import { Test, TestingModule } from '@nestjs/testing';
import { ProfesorService } from './profesor.service';
import { PrismaService } from '../prisma/prisma.service';

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

  describe('getOrCreateDefaultProfesor', () => {
    it('retorna el profesor existente si ya fue creado', async () => {
      const mockProf = {
        id: 'prof-1',
        nombre: 'Juan',
        apellido: 'Pérez',
        email: 'profesor@evalia.com',
        googleId: 'default-google-id',
      };
      mockPrisma.profesor.findFirst.mockResolvedValue(mockProf);

      const result = await service.getOrCreateDefaultProfesor();
      expect(result).toEqual(mockProf);
      expect(mockPrisma.profesor.create).not.toHaveBeenCalled();
    });

    it('crea un nuevo profesor por defecto si la base de datos está vacía', async () => {
      mockPrisma.profesor.findFirst.mockResolvedValue(null);
      const newProf = {
        id: 'prof-new',
        nombre: 'Profesor',
        apellido: 'Titular',
        email: 'profesor@evalia.com',
        googleId: 'default-google-id',
      };
      mockPrisma.profesor.create.mockResolvedValue(newProf);

      const result = await service.getOrCreateDefaultProfesor();
      expect(result).toEqual(newProf);
      expect(mockPrisma.profesor.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProfile', () => {
    it('retorna el profesor por ID si se envía teacherId', async () => {
      const mockProf = { id: 'prof-123', nombre: 'Carlos', apellido: 'Gómez' };
      mockPrisma.profesor.findUnique.mockResolvedValue(mockProf);

      const result = await service.getProfile('prof-123');
      expect(result).toEqual(mockProf);
    });

    it('retorna el profesor default si teacherId no existe o no se envía', async () => {
      mockPrisma.profesor.findUnique.mockResolvedValue(null);
      mockPrisma.profesor.findFirst.mockResolvedValue({ id: 'prof-def' });

      const result = await service.getProfile('non-existent');
      expect(result).toEqual({ id: 'prof-def' });
    });
  });

  describe('updateProfile', () => {
    it('actualiza el nombre y apellido del profesor', async () => {
      mockPrisma.profesor.findFirst.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.profesor.update.mockResolvedValue({
        id: 'prof-1',
        nombre: 'Ana',
        apellido: 'Martínez',
      });

      const result = await service.updateProfile({
        nombre: 'Ana',
        apellido: 'Martínez',
      });

      expect(mockPrisma.profesor.update).toHaveBeenCalledWith({
        where: { id: 'prof-1' },
        data: { nombre: 'Ana', apellido: 'Martínez' },
      });
      expect(result.nombre).toBe('Ana');
    });
  });
});
