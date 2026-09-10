import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportesController (HTTP Endpoints)', () => {
  let app: INestApplication;

  const mockExamen = {
    id: 'exam-123',
    titulo: 'Examen de Matemática Aplicada',
    fecha: new Date('2026-09-01T10:00:00Z'),
    curso: {
      id: 'curso-123',
      materia: 'Matemática Aplicada',
      division: 'División A',
      anio: 5,
      anioLectivo: 2026,
    },
    entregas: [
      {
        id: 'ent-1',
        alumnoId: 'a1',
        estado: 'PUBLICADO',
        alumno: {
          id: 'a1',
          legajo: 'L-101',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
        correccion: {
          notaFinal: 9.5,
          nivelConfianza: 'ALTO',
          fechaAprobacion: new Date('2026-09-02T12:00:00Z'),
        },
      },
    ],
  };

  const mockCurso = {
    id: 'curso-123',
    materia: 'Matemática Aplicada',
    division: 'División A',
    anio: 5,
    anioLectivo: 2026,
    examenes: [mockExamen],
    alumnos: [
      {
        alumno: {
          id: 'a1',
          legajo: 'L-101',
          nombre: 'Juan',
          apellido: 'Pérez',
        },
      },
    ],
  };

  const mockPrismaService = {
    examen: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'exam-123') return Promise.resolve(mockExamen);
          return Promise.resolve(null);
        }),
    },
    curso: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'curso-123') return Promise.resolve(mockCurso);
          return Promise.resolve(null);
        }),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportesController],
      providers: [
        ReportesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/reportes/examen/:examenId/csv', () => {
    it('retorna 200, cabeceras correctas, BOM y sep=,', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reportes/examen/exam-123/csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="notas-matematica-aplicada-division-a-2026-09-01.csv"',
      );
      expect(response.text.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(response.text).toContain('L-101,Juan,Perez,9.5,ALTO,2026-09-02');
    });

    it('retorna 404 si el examen no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reportes/examen/inexistente/csv')
        .expect(404);
    });
  });

  describe('GET /api/v1/reportes/examen/:examenId/pdf', () => {
    it('retorna 200, cabeceras correctas y binario PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reportes/examen/exam-123/pdf')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="notas-matematica-aplicada-division-a-2026-09-01.pdf"',
      );
      expect(response.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('retorna 404 si el examen no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reportes/examen/inexistente/pdf')
        .expect(404);
    });
  });

  describe('GET /api/v1/reportes/curso/:cursoId/csv', () => {
    it('retorna 200, cabeceras correctas, BOM y sep=,', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reportes/curso/curso-123/csv')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="notas-matematica-aplicada-division-a-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
      expect(response.text.startsWith('\uFEFFsep=,\n')).toBe(true);
      expect(response.text).toContain('L-101,Juan,Perez,9.5,9.5');
    });

    it('retorna 404 si el curso no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reportes/curso/inexistente/csv')
        .expect(404);
    });
  });

  describe('GET /api/v1/reportes/curso/:cursoId/pdf', () => {
    it('retorna 200, cabeceras correctas y binario PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reportes/curso/curso-123/pdf')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toMatch(
        /^attachment; filename="notas-matematica-aplicada-division-a-\d{4}-\d{2}-\d{2}\.pdf"$/,
      );
      expect(response.body.toString('utf-8', 0, 4)).toBe('%PDF');
    });

    it('retorna 404 si el curso no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reportes/curso/inexistente/pdf')
        .expect(404);
    });
  });
});
