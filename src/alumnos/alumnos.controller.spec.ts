import { Test, TestingModule } from '@nestjs/testing';
import { AlumnosController } from './alumnos.controller';
import { AlumnosService } from './alumnos.service';

describe('AlumnosController', () => {
  let controller: AlumnosController;
  let service: AlumnosService;

  const mockAlumnosService = {
    getAlumnos: jest.fn().mockResolvedValue({
      data: [{ id: '1', nombre: 'Juan Perez', legajo: '38123456' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    }),
    getAlumno: jest.fn().mockResolvedValue({
      id: '1',
      nombre: 'Juan Perez',
      legajo: '38123456',
    }),
    createAlumno: jest.fn().mockResolvedValue({
      id: '1',
      nombre: 'Juan Perez',
      legajo: '38123456',
    }),
    updateAlumno: jest.fn().mockResolvedValue({
      id: '1',
      nombre: 'Juan Modificado',
      legajo: '38123456',
    }),
    deleteAlumno: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlumnosController],
      providers: [
        {
          provide: AlumnosService,
          useValue: mockAlumnosService,
        },
      ],
    }).compile();

    controller = module.get<AlumnosController>(AlumnosController);
    service = module.get<AlumnosService>(AlumnosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should list alumnos with pagination and filter', async () => {
    const res = await controller.getAlumnos('curso-1', '1', '10');
    expect(service.getAlumnos).toHaveBeenCalledWith('curso-1', 1, 10);
    expect(res.data).toHaveLength(1);
  });

  it('should get one alumno by id', async () => {
    const res = await controller.getAlumno('1');
    expect(service.getAlumno).toHaveBeenCalledWith('1');
    expect(res.id).toBe('1');
  });

  it('should create an alumno', async () => {
    const dto = { nombre: 'Juan Perez', legajo: '38123456', cursoId: 'curso-1' };
    const res = await controller.createAlumno(dto);
    expect(service.createAlumno).toHaveBeenCalledWith(dto);
    expect(res.nombre).toBe('Juan Perez');
  });

  it('should update an alumno', async () => {
    const dto = { nombre: 'Juan Modificado' };
    const res = await controller.updateAlumno('1', dto);
    expect(service.updateAlumno).toHaveBeenCalledWith('1', dto);
    expect(res.nombre).toBe('Juan Modificado');
  });

  it('should delete an alumno', async () => {
    const res = await controller.deleteAlumno('1');
    expect(service.deleteAlumno).toHaveBeenCalledWith('1');
    expect(res.success).toBe(true);
  });
});
