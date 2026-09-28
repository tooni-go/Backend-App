import { Test, TestingModule } from '@nestjs/testing';
import { ProfesorController } from './profesor.controller';
import { ProfesorService } from './profesor.service';

describe('ProfesorController', () => {
  let controller: ProfesorController;

  const mockProfesorService = {
    getProfile: jest.fn().mockResolvedValue({
      id: 'prof-1',
      nombre: 'Profesor',
      apellido: 'Titular',
      email: 'profesor@evalia.com',
    }),
    updateProfile: jest.fn().mockResolvedValue({
      id: 'prof-1',
      nombre: 'Nuevo',
      apellido: 'Nombre',
      email: 'profesor@evalia.com',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfesorController],
      providers: [
        { provide: ProfesorService, useValue: mockProfesorService },
      ],
    }).compile();

    controller = module.get<ProfesorController>(ProfesorController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /api/v1/profesor/me retorna el perfil del profesor', async () => {
    const res = await controller.getMe();
    expect(res).toEqual({
      id: 'prof-1',
      nombre: 'Profesor',
      apellido: 'Titular',
      email: 'profesor@evalia.com',
    });
    expect(mockProfesorService.getProfile).toHaveBeenCalled();
  });

  it('PUT /api/v1/profesor/me actualiza el perfil del profesor', async () => {
    const res = await controller.updateMe({ nombre: 'Nuevo', apellido: 'Nombre' });
    expect(res.nombre).toBe('Nuevo');
    expect(mockProfesorService.updateProfile).toHaveBeenCalledWith(
      { nombre: 'Nuevo', apellido: 'Nombre' },
      undefined,
    );
  });
});
