import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ParSospechoso {
  preguntaId: string;
  enunciadoPregunta: string;
  alumnoAId: string;
  alumnoBId: string;
  similitud: number; // 0.0 a 1.0, redondeado a 2 decimales
  nivel: 'ALTA' | 'MEDIA';
  fragmentoA: string; // Primeros 200 caracteres de la respuesta A
  fragmentoB: string; // Primeros 200 caracteres de la respuesta B
}

export interface ResultadoSimilitud {
  examenId: string;
  totalAlumnos: number;
  totalPreguntasAnalizadas: number;
  totalParesComparados: number;
  alertas: ParSospechoso[];
  generadoEn: string; // ISO 8601
}

interface ItemFeedbackParsed {
  preguntaId: string;
  respuesta: string;
}

@Injectable()
export class SimilitudService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normaliza un texto para la comparación:
   * - Convierte a minúsculas
   * - Elimina tildes y diacríticos
   * - Reemplaza signos de puntuación y caracteres especiales por espacios
   * - Colapsa espacios múltiples y elimina espacios en los extremos
   */
  normalizar(texto: string): string {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cuenta las palabras de un texto normalizado.
   */
  contarPalabras(texto: string): number {
    const norm = this.normalizar(texto);
    if (!norm) return 0;
    return norm.split(' ').filter((palabra) => palabra.length > 0).length;
  }

  /**
   * Genera el conjunto de bigramas de palabras a partir de un texto.
   * Ejemplo: "hola mundo test" -> Set {"hola mundo", "mundo test"}
   */
  bigramas(texto: string): Set<string> {
    const norm = this.normalizar(texto);
    if (!norm) return new Set();
    const palabras = norm.split(' ').filter((palabra) => palabra.length > 0);
    const resultado = new Set<string>();

    for (let i = 0; i < palabras.length - 1; i++) {
      resultado.add(`${palabras[i]} ${palabras[i + 1]}`);
    }

    return resultado;
  }

  /**
   * Calcula el coeficiente de similitud de Jaccard sobre bigramas de palabras:
   * J(A, B) = |A ∩ B| / |A ∪ B|
   * Retorna un valor entre 0.0 y 1.0 redondeado a 2 decimales.
   */
  similitudJaccard(a: string, b: string): number {
    const normA = this.normalizar(a);
    const normB = this.normalizar(b);

    if (!normA && !normB) return 0;
    if (normA === normB) return 1.0;

    const setA = this.bigramas(normA);
    const setB = this.bigramas(normB);

    if (setA.size === 0 || setB.size === 0) {
      // Si alguno no tiene suficientes palabras para formar bigramas
      return normA === normB ? 1.0 : 0.0;
    }

    let interseccion = 0;
    for (const bg of setA) {
      if (setB.has(bg)) {
        interseccion++;
      }
    }

    const union = setA.size + setB.size - interseccion;
    if (union === 0) return 0;

    const jaccard = interseccion / union;
    return Math.round(jaccard * 100) / 100;
  }

  /**
   * Heurística para determinar si una pregunta es de desarrollo (pregunta abierta)
   * frente a consignas de opción múltiple o verdadero/falso.
   * - Descarta respuestas cortas típicas de choice (ej: "A", "Opción B", "Verdadero", "Falso").
   * - Requiere que la respuesta esperada contenga al menos 5 palabras explicativas.
   */
  esPreguntaDesarrollo(pregunta: {
    enunciado?: string;
    respuestaEsperada?: string;
  }): boolean {
    if (!pregunta || !pregunta.respuestaEsperada) {
      return false;
    }

    const texto = pregunta.respuestaEsperada.trim();
    const palabras = texto.split(/\s+/).filter((w) => w.length > 0);

    // Detección de patrones de múltiple choice o verdadero/falso
    const esOpcionCorta =
      /^(opci[oó]n\s+[a-d]|verdadero|falso|[a-d]\)|[a-d]$)/i.test(texto) ||
      (palabras.length <= 3 && /^[a-d]$/i.test(palabras[0]));

    if (esOpcionCorta) {
      return false;
    }

    return palabras.length >= 5;
  }

  /**
   * Extrae de forma segura las respuestas de los alumnos del campo feedbackJSON de la Corrección.
   * Soporta múltiples esquemas: array de items, objeto con propiedad preguntas o mapa por preguntaId.
   */
  extraerRespuestasFeedback(
    feedbackJSON: string | null | undefined,
  ): ItemFeedbackParsed[] {
    if (!feedbackJSON) return [];

    try {
      const parsed =
        typeof feedbackJSON === 'string'
          ? JSON.parse(feedbackJSON)
          : feedbackJSON;

      let items: any[] = [];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && Array.isArray(parsed.preguntas)) {
        items = parsed.preguntas;
      } else if (parsed && typeof parsed === 'object') {
        items = Object.entries(parsed).map(([key, val]) => {
          if (val && typeof val === 'object') {
            return { preguntaId: key, ...(val as any) };
          }
          return { preguntaId: key, respuestaAlumno: String(val) };
        });
      }

      const resultados: ItemFeedbackParsed[] = [];
      for (const item of items) {
        if (!item) continue;
        const preguntaId =
          item.preguntaId || item.id || item.pregunta_id || item.idPregunta;
        const respuesta =
          item.respuestaAlumno ||
          item.textoDetectado ||
          item.respuesta ||
          item.texto ||
          item.respuesta_alumno ||
          '';

        if (preguntaId && typeof respuesta === 'string') {
          resultados.push({
            preguntaId: String(preguntaId),
            respuesta: respuesta.trim(),
          });
        }
      }

      return resultados;
    } catch {
      return [];
    }
  }

  /**
   * Analiza la similitud de respuestas entre todos los alumnos de un examen
   * para detectar posibles copias o plagio en preguntas de desarrollo.
   */
  async analizarSimilitudExamen(examenId: string): Promise<ResultadoSimilitud> {
    const examen = await this.prisma.examen.findUnique({
      where: { id: examenId },
      include: {
        preguntas: true,
        entregas: {
          include: {
            correccion: true,
          },
        },
      },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${examenId} no encontrado.`);
    }

    const preguntasDesarrollo = (examen.preguntas || []).filter((p) =>
      this.esPreguntaDesarrollo(p),
    );

    // Solo se analizan entregas con estado PUBLICADO y corrección existente
    const entregasPublicadas = (examen.entregas || []).filter(
      (e) => e.estado === 'PUBLICADO' && Boolean(e.correccion?.feedbackJSON),
    );

    const alumnosUnicos = new Set(entregasPublicadas.map((e) => e.alumnoId));
    const totalAlumnos = alumnosUnicos.size;

    const alertas: ParSospechoso[] = [];
    let totalParesComparados = 0;

    // Si no hay entregas publicadas o solo hay 1 alumno, no hay combinaciones posibles
    if (entregasPublicadas.length < 2 || totalAlumnos < 2) {
      return {
        examenId: examen.id,
        totalAlumnos,
        totalPreguntasAnalizadas: preguntasDesarrollo.length,
        totalParesComparados: 0,
        alertas: [],
        generadoEn: new Date().toISOString(),
      };
    }

    // Pre-procesar respuestas por entrega
    const respuestasPorEntrega = entregasPublicadas.map((entrega) => ({
      alumnoId: entrega.alumnoId,
      respuestas: this.extraerRespuestasFeedback(
        entrega.correccion?.feedbackJSON,
      ),
    }));

    for (const pregunta of preguntasDesarrollo) {
      // Recolectar respuestas válidas de los alumnos para esta pregunta
      const respuestasValidas: { alumnoId: string; texto: string }[] = [];

      for (const item of respuestasPorEntrega) {
        const encontrada = item.respuestas.find(
          (r) => r.preguntaId === pregunta.id,
        );

        if (encontrada && encontrada.respuesta) {
          // Filtrar respuestas vacías o muy cortas (menos de 5 palabras)
          if (this.contarPalabras(encontrada.respuesta) >= 5) {
            respuestasValidas.push({
              alumnoId: item.alumnoId,
              texto: encontrada.respuesta,
            });
          }
        }
      }

      const N = respuestasValidas.length;
      if (N < 2) {
        continue;
      }

      // Comparar todos los pares posibles de respuestas (N * (N - 1) / 2)
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          totalParesComparados++;

          const alumnoA = respuestasValidas[i];
          const alumnoB = respuestasValidas[j];

          const similitud = this.similitudJaccard(
            alumnoA.texto,
            alumnoB.texto,
          );

          if (similitud >= 0.65) {
            const nivel = similitud >= 0.85 ? 'ALTA' : 'MEDIA';
            alertas.push({
              preguntaId: pregunta.id,
              enunciadoPregunta: pregunta.enunciado,
              alumnoAId: alumnoA.alumnoId,
              alumnoBId: alumnoB.alumnoId,
              similitud,
              nivel,
              fragmentoA: alumnoA.texto.slice(0, 200),
              fragmentoB: alumnoB.texto.slice(0, 200),
            });
          }
        }
      }
    }

    // Ordenar alertas de mayor a menor similitud
    alertas.sort((a, b) => b.similitud - a.similitud);

    return {
      examenId: examen.id,
      totalAlumnos,
      totalPreguntasAnalizadas: preguntasDesarrollo.length,
      totalParesComparados,
      alertas,
      generadoEn: new Date().toISOString(),
    };
  }
}
