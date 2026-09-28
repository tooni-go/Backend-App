import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AiService } from '../src/ai/ai.service';
import {
  TipoAjuste,
  NivelDificultad,
  FormatoDestino,
} from '../src/examenes/dto/regenerar-pregunta.dto';

describe('Regeneración Individual de Preguntas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let aiService: AiService;
  let testCursoId: string;
  let testExamenId: string;
  let testPreguntaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    aiService = moduleFixture.get<AiService>(AiService);

    // Configurar datos de prueba en la base de datos
    const profesor = await prisma.profesor.upsert({
      where: { email: 'profesor.test@evalia.com' },
      update: {},
      create: {
        nombre: 'Profesor',
        apellido: 'Test',
        email: 'profesor.test@evalia.com',
        googleId: 'test-google-id-12345',
      },
    });

    const curso = await prisma.curso.create({
      data: {
        materia: 'Física I',
        anio: 3,
        division: 'A',
        anioLectivo: 2026,
        profesorId: profesor.id,
      },
    });
    testCursoId = curso.id;

    const examen = await prisma.examen.create({
      data: {
        titulo: 'Examen de Mecánica Clásica',
        cursoId: testCursoId,
        preguntas: {
          create: [
            {
              enunciado: 'Enuncie la segunda ley de Newton.',
              respuestaEsperada: 'F = m * a',
              puntajeMaximo: 5,
              criteriosIA:
                'Verificar relación vectorial entre fuerza y aceleración.',
              esEvaluacionVisual: false,
            },
          ],
        },
      },
      include: { preguntas: true },
    });
    testExamenId = examen.id;
    testPreguntaId = examen.preguntas[0].id;
  });

  afterAll(async () => {
    // Limpieza de datos
    if (testPreguntaId) {
      await prisma.pregunta.deleteMany({ where: { examenId: testExamenId } });
    }
    if (testExamenId) {
      await prisma.examen.deleteMany({ where: { id: testExamenId } });
    }
    if (testCursoId) {
      await prisma.curso.deleteMany({ where: { id: testCursoId } });
    }
    await app.close();
  });

  describe('POST /api/v1/examenes/preguntas/regenerar-individual', () => {
    it('1. Debe responder 200 y regenerar exitosamente con REFRASEO', async () => {
      const mockSugerencia = {
        enunciado:
          'Explique el principio fundamental de la dinámica (segunda ley de Newton).',
        respuestaEsperada:
          'La fuerza neta es directamente proporcional al producto de la masa por la aceleración (F = m * a).',
        esEvaluacionVisual: false,
      };

      jest
        .spyOn(aiService, 'regenerarPregunta')
        .mockResolvedValueOnce(mockSugerencia);

      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: TipoAjuste.REFRASEO,
        })
        .expect(201); // NestJS default POST status is 201 (or 200)

      expect(response.body).toEqual({
        preguntaOriginal: {
          id: testPreguntaId,
          enunciado: 'Enuncie la segunda ley de Newton.',
          respuestaEsperada: 'F = m * a',
          puntajeMaximo: 5,
        },
        sugerencia: mockSugerencia,
        tipoAjuste: TipoAjuste.REFRASEO,
      });

      // Validar que la base de datos NO fue modificada
      const preguntaEnDb = await prisma.pregunta.findUnique({
        where: { id: testPreguntaId },
      });
      expect(preguntaEnDb?.enunciado).toBe('Enuncie la segunda ley de Newton.');
    });

    it('2. Debe responder 200 y regenerar con CAMBIO_DIFICULTAD -> DIFICIL', async () => {
      const mockSugerencia = {
        enunciado:
          'Demuestre analíticamente cómo la segunda ley de Newton (F = dp/dt) se reduce a F = m*a para masa constante.',
        respuestaEsperada:
          'Derivada del momento lineal p = m*v con respecto al tiempo: dp/dt = m*(dv/dt) = m*a cuando m es constante.',
        esEvaluacionVisual: false,
      };

      jest
        .spyOn(aiService, 'regenerarPregunta')
        .mockResolvedValueOnce(mockSugerencia);

      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: TipoAjuste.CAMBIO_DIFICULTAD,
          parametros: {
            nivelDificultad: NivelDificultad.DIFICIL,
          },
        })
        .expect(201);

      expect(response.body.sugerencia).toEqual(mockSugerencia);
      expect(response.body.tipoAjuste).toBe(TipoAjuste.CAMBIO_DIFICULTAD);
      expect(response.body.parametros).toEqual({
        nivelDificultad: NivelDificultad.DIFICIL,
      });
    });

    it('3. Debe responder 200 y regenerar con CAMBIO_FORMATO -> MULTIPLE_CHOICE', async () => {
      const mockSugerencia = {
        enunciado:
          '¿Cuál es la expresión matemática de la 2da ley de Newton?\nA) F = m/a\nB) F = m * a\nC) F = a/m\nD) F = m * v',
        respuestaEsperada: 'Opción B (F = m * a)',
        esEvaluacionVisual: false,
      };

      jest
        .spyOn(aiService, 'regenerarPregunta')
        .mockResolvedValueOnce(mockSugerencia);

      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: TipoAjuste.CAMBIO_FORMATO,
          parametros: {
            formatoDestino: FormatoDestino.MULTIPLE_CHOICE,
          },
        })
        .expect(201);

      expect(response.body.sugerencia).toEqual(mockSugerencia);
      expect(response.body.tipoAjuste).toBe(TipoAjuste.CAMBIO_FORMATO);
      expect(response.body.parametros).toEqual({
        formatoDestino: FormatoDestino.MULTIPLE_CHOICE,
      });
    });

    it('4. Debe responder 404 si el preguntaId no existe en la base de datos', async () => {
      const fakeId = 'c0000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: fakeId,
          tipoAjuste: TipoAjuste.REFRASEO,
        })
        .expect(404);

      expect(response.body.message).toBe(
        `Pregunta con ID ${fakeId} no encontrada.`,
      );
    });

    it('5. Debe responder 400 si tipoAjuste es CAMBIO_DIFICULTAD y falta nivelDificultad', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: TipoAjuste.CAMBIO_DIFICULTAD,
        })
        .expect(400);

      expect(response.body.message).toContain(
        'Para el tipo de ajuste CAMBIO_DIFICULTAD debe especificar el parámetro nivelDificultad',
      );
    });

    it('6. Debe responder 400 si tipoAjuste es CAMBIO_FORMATO y falta formatoDestino', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: TipoAjuste.CAMBIO_FORMATO,
        })
        .expect(400);

      expect(response.body.message).toContain(
        'Para el tipo de ajuste CAMBIO_FORMATO debe especificar el parámetro formatoDestino',
      );
    });

    it('7. Debe responder 400 si tipoAjuste es un valor inválido no contemplado en el Enum', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          preguntaId: testPreguntaId,
          tipoAjuste: 'TIPO_INVALIDO',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('8. Debe responder 400 si falta el campo obligatorio preguntaId', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/examenes/preguntas/regenerar-individual')
        .send({
          tipoAjuste: TipoAjuste.REFRASEO,
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });
});
