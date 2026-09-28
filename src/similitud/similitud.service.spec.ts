import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SimilitudService } from './similitud.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SimilitudService', () => {
  let service: SimilitudService;

  const mockPrismaService: any = {
    examen: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimilitudService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SimilitudService>(SimilitudService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Métodos auxiliares y Algoritmo de Jaccard', () => {
    it('normalizar debe limpiar puntuación, tildes, mayúsculas y espacios múltiples', () => {
      const texto = '  ¡Hola, MÚNDO!   ¿Cómo estás hoy? (Test: 123)  ';
      const normalizado = service.normalizar(texto);
      expect(normalizado).toBe('hola mundo como estas hoy test 123');
    });

    it('normalizar debe retornar cadena vacía ante entrada vacía o nula', () => {
      expect(service.normalizar('')).toBe('');
      expect(service.normalizar(null as any)).toBe('');
      expect(service.normalizar(undefined as any)).toBe('');
    });

    it('contarPalabras debe calcular la cantidad correcta de palabras', () => {
      expect(service.contarPalabras('uno dos tres cuatro cinco')).toBe(5);
      expect(service.contarPalabras('   hola    mundo   ')).toBe(2);
      expect(service.contarPalabras('')).toBe(0);
    });

    it('bigramas debe generar los pares de palabras consecutivos', () => {
      const texto = 'hola mundo test ejemplo';
      const bgs = service.bigramas(texto);
      expect(Array.from(bgs)).toEqual([
        'hola mundo',
        'mundo test',
        'test ejemplo',
      ]);
    });

    it('bigramas debe retornar conjunto vacío si hay menos de 2 palabras', () => {
      expect(service.bigramas('hola').size).toBe(0);
      expect(service.bigramas('').size).toBe(0);
    });

    it('esPreguntaDesarrollo debe identificar preguntas abiertas y descartar multiple choice o V/F', () => {
      // Multiple choice / V/F cortas
      expect(
        service.esPreguntaDesarrollo({ respuestaEsperada: 'Opción B' }),
      ).toBe(false);
      expect(
        service.esPreguntaDesarrollo({ respuestaEsperada: 'Verdadero' }),
      ).toBe(false);
      expect(
        service.esPreguntaDesarrollo({ respuestaEsperada: 'Falso' }),
      ).toBe(false);
      expect(
        service.esPreguntaDesarrollo({ respuestaEsperada: 'A' }),
      ).toBe(false);
      expect(
        service.esPreguntaDesarrollo({ respuestaEsperada: 'b)' }),
      ).toBe(false);

      // Pregunta de desarrollo
      expect(
        service.esPreguntaDesarrollo({
          respuestaEsperada:
            'La fotosíntesis es el proceso bioquímico mediante el cual las plantas convierten dióxido de carbono en glucosa.',
        }),
      ).toBe(true);

      expect(
        service.esPreguntaDesarrollo({
          respuestaEsperada:
            'Explicar el ciclo del agua detallando evaporación, condensación y precipitación.',
        }),
      ).toBe(true);
    });

    it('extraerRespuestasFeedback debe parsear diferentes formatos de feedbackJSON de forma robusta', () => {
      // 1. Array estándar
      const jsonArray = JSON.stringify([
        { preguntaId: 'p1', respuestaAlumno: 'Respuesta del alumno uno' },
        { preguntaId: 'p2', textoDetectado: 'Respuesta del alumno dos' },
      ]);
      const res1 = service.extraerRespuestasFeedback(jsonArray);
      expect(res1).toHaveLength(2);
      expect(res1[0]).toEqual({
        preguntaId: 'p1',
        respuesta: 'Respuesta del alumno uno',
      });
      expect(res1[1]).toEqual({
        preguntaId: 'p2',
        respuesta: 'Respuesta del alumno dos',
      });

      // 2. Objeto con propiedad preguntas
      const jsonObj = JSON.stringify({
        preguntas: [
          { preguntaId: 'p1', respuesta: 'Respuesta con campo respuesta' },
        ],
      });
      const res2 = service.extraerRespuestasFeedback(jsonObj);
      expect(res2).toHaveLength(1);
      expect(res2[0].respuesta).toBe('Respuesta con campo respuesta');

      // 3. JSON inválido o corrupto no debe lanzar excepción
      expect(service.extraerRespuestasFeedback('JSON_INVALIDO')).toEqual([]);
      expect(service.extraerRespuestasFeedback(null)).toEqual([]);
    });
  });

  describe('analizarSimilitudExamen - Escenarios de Integridad Académica', () => {
    const preguntaDesarrolloMock = {
      id: 'preg-1',
      enunciado: 'Explique en detalle el proceso de la fotosíntesis en las plantas.',
      respuestaEsperada:
        'La fotosíntesis es el proceso mediante el cual los organismos autótrofos convierten energía lumínica en energía química.',
      puntajeMaximo: 10,
    };

    // 1. Textos idénticos -> similitud 1.0, nivel ALTA
    it('1. Textos idénticos: debe detectar similitud 1.0 y nivel ALTA', async () => {
      const textoIdentico =
        'La fotosíntesis es el proceso por el cual las plantas capturan la luz del sol para sintetizar glucosa y liberar oxígeno a la atmósfera a través de la clorofila en los cloroplastos.';

      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-1',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoIdentico },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoIdentico },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-1');

      expect(resultado.totalAlumnos).toBe(2);
      expect(resultado.totalPreguntasAnalizadas).toBe(1);
      expect(resultado.totalParesComparados).toBe(1);
      expect(resultado.alertas).toHaveLength(1);

      const alerta = resultado.alertas[0];
      expect(alerta.preguntaId).toBe('preg-1');
      expect(alerta.enunciadoPregunta).toBe(preguntaDesarrolloMock.enunciado);
      expect(alerta.alumnoAId).toBe('alumno-A');
      expect(alerta.alumnoBId).toBe('alumno-B');
      expect(alerta.similitud).toBe(1.0);
      expect(alerta.nivel).toBe('ALTA');
      expect(alerta.fragmentoA).toBe(textoIdentico.slice(0, 200));
      expect(alerta.fragmentoB).toBe(textoIdentico.slice(0, 200));
    });

    // 2. Textos completamente distintos -> similitud < 0.65, no aparece en alertas
    it('2. Textos completamente distintos: similitud < 0.65, no genera alertas', async () => {
      const textoA =
        'La fotosíntesis ocurre en los cloroplastos donde se absorbe energía lumínica con pigmentos de clorofila.';
      const textoB =
        'La revolución industrial trajo cambios drásticos en la manufactura con máquinas a vapor y ferrocarriles de transporte masivo.';

      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-2',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoA },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoB },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-2');

      expect(resultado.totalAlumnos).toBe(2);
      expect(resultado.totalParesComparados).toBe(1);
      expect(resultado.alertas).toHaveLength(0);
    });

    // 3. Textos parcialmente similares -> similitud entre 0.65 y 0.85, nivel MEDIA
    it('3. Textos parcialmente similares: genera alerta con nivel MEDIA (0.65 <= similitud < 0.85)', async () => {
      // Creamos dos textos que comparten la mayoría de bigramas con ligeras variaciones
      const textoA =
        'la fotosintesis es el proceso fundamental mediante el cual las plantas verdes capturan la energia de la luz solar para sintetizar glucosa y liberar oxigeno puro a la atmosfera terrestre';
      const textoB =
        'la fotosintesis es el mecanismo fundamental mediante el cual las plantas verdes capturan la energia proveniente de la luz solar para generar glucosa y liberar oxigeno puro a la atmosfera terrestre';

      const sim = service.similitudJaccard(textoA, textoB);
      expect(sim).toBeGreaterThanOrEqual(0.65);
      expect(sim).toBeLessThan(0.85);

      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-3',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoA },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoB },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-3');

      expect(resultado.alertas).toHaveLength(1);
      expect(resultado.alertas[0].nivel).toBe('MEDIA');
      expect(resultado.alertas[0].similitud).toBe(sim);
    });

    // 4. Examen sin entregas publicadas -> alertas: [], totalParesComparados: 0
    it('4. Examen sin entregas publicadas: retorna alertas vacías y 0 pares comparados', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-4',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PENDIENTE',
            correccion: null,
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'REQUIERE_REVISION',
            correccion: { feedbackJSON: '[]' },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-4');

      expect(resultado.totalAlumnos).toBe(0);
      expect(resultado.totalParesComparados).toBe(0);
      expect(resultado.alertas).toEqual([]);
      expect(resultado.totalPreguntasAnalizadas).toBe(1);
    });

    // 5. Examen con un solo alumno -> no hay pares posibles, alertas: []
    it('5. Examen con un solo alumno: no hay pares posibles, retorna alertas vacías', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-5',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-unico',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                {
                  preguntaId: 'preg-1',
                  respuestaAlumno:
                    'Esta es una respuesta detallada con mas de diez palabras completas.',
                },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-5');

      expect(resultado.totalAlumnos).toBe(1);
      expect(resultado.totalParesComparados).toBe(0);
      expect(resultado.alertas).toEqual([]);
    });

    // 6. Respuesta vacía o muy corta (menos de 5 palabras) -> se skipea silenciosamente
    it('6. Respuesta corta (< 5 palabras): se skipea silenciosamente sin generar error ni alerta', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-6',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                {
                  preguntaId: 'preg-1',
                  respuestaAlumno: 'Respuesta muy corta', // 3 palabras (< 5)
                },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                {
                  preguntaId: 'preg-1',
                  respuestaAlumno: 'Respuesta muy corta', // 3 palabras (< 5)
                },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-6');

      expect(resultado.totalAlumnos).toBe(2);
      expect(resultado.totalParesComparados).toBe(0); // Al skipearse ambas, no hay pares válidos para la pregunta
      expect(resultado.alertas).toEqual([]);
    });

    // 7. Tres alumnos con el mismo texto -> genera 3 pares sospechosos (A-B, A-C, B-C) todos nivel ALTA
    it('7. Tres alumnos con el mismo texto: genera 3 pares sospechosos con nivel ALTA', async () => {
      const textoIdentico =
        'La fotosíntesis convierte energía luminosa en energía química almacenada en moléculas de glucosa indispensables para la vida vegetal.';

      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-7',
        preguntas: [preguntaDesarrolloMock],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoIdentico },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoIdentico },
              ]),
            },
          },
          {
            id: 'ent-3',
            alumnoId: 'alumno-C',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-1', respuestaAlumno: textoIdentico },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-7');

      expect(resultado.totalAlumnos).toBe(3);
      expect(resultado.totalParesComparados).toBe(3); // 3 * 2 / 2 = 3 pares
      expect(resultado.alertas).toHaveLength(3);

      const pares = resultado.alertas.map((a) => `${a.alumnoAId}-${a.alumnoBId}`);
      expect(pares).toContain('alumno-A-alumno-B');
      expect(pares).toContain('alumno-A-alumno-C');
      expect(pares).toContain('alumno-B-alumno-C');

      resultado.alertas.forEach((alerta) => {
        expect(alerta.similitud).toBe(1.0);
        expect(alerta.nivel).toBe('ALTA');
        expect(alerta.preguntaId).toBe('preg-1');
      });
    });

    // 8. Examen no existente -> lanza NotFoundException
    it('8. Examen no encontrado: lanza NotFoundException', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue(null);

      await expect(
        service.analizarSimilitudExamen('examen-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    // 9. Examen con preguntas solo múltiple choice -> no se analizan
    it('9. Examen con preguntas solo múltiple choice: se filtran y totalPreguntasAnalizadas es 0', async () => {
      mockPrismaService.examen.findUnique.mockResolvedValue({
        id: 'examen-choice',
        preguntas: [
          {
            id: 'preg-choice-1',
            enunciado: '¿Cuál es la capital de Francia?',
            respuestaEsperada: 'Opción B',
            puntajeMaximo: 5,
          },
          {
            id: 'preg-choice-2',
            enunciado: '¿El agua hierve a 100°C?',
            respuestaEsperada: 'Verdadero',
            puntajeMaximo: 5,
          },
        ],
        entregas: [
          {
            id: 'ent-1',
            alumnoId: 'alumno-A',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-choice-1', respuestaAlumno: 'Opción B' },
              ]),
            },
          },
          {
            id: 'ent-2',
            alumnoId: 'alumno-B',
            estado: 'PUBLICADO',
            correccion: {
              feedbackJSON: JSON.stringify([
                { preguntaId: 'preg-choice-1', respuestaAlumno: 'Opción B' },
              ]),
            },
          },
        ],
      });

      const resultado = await service.analizarSimilitudExamen('examen-choice');

      expect(resultado.totalPreguntasAnalizadas).toBe(0);
      expect(resultado.totalParesComparados).toBe(0);
      expect(resultado.alertas).toEqual([]);
    });
  });
});
