import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, GeneratedExam } from '../ai/ai.service';
import { RegenerarPreguntaDto, TipoAjuste } from './dto/regenerar-pregunta.dto';

export class UpdateExamenDto {
  titulo: string;
  puntajeTotal: number;
  preguntas: Array<{
    enunciado: string;
    respuestaEsperada: string;
    puntajeMaximo: number;
    criteriosIA?: string | null;
    esEvaluacionVisual?: boolean;
  }>;
}

@Injectable()
export class ExamenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async generateExam(params: {
    texto?: string;
    file?: Express.Multer.File;
  }): Promise<GeneratedExam> {
    return this.aiService.generateExam({
      texto: params.texto,
      fileBuffer: params.file?.buffer,
      mimeType: params.file?.mimetype,
    });
  }

  async getExamen(id: string) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: {
        preguntas: true,
        entregas: true,
        curso: {
          include: {
            alumnos: {
              include: {
                alumno: true,
              },
            },
          },
        },
      },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);
    }

    return examen;
  }

  async updateExamen(id: string, dto: UpdateExamenDto) {
    const examen = await this.prisma.examen.findUnique({ where: { id } });
    if (!examen)
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);

    return this.prisma.$transaction(async (tx) => {
      await tx.pregunta.deleteMany({
        where: { examenId: id },
      });

      return tx.examen.update({
        where: { id },
        data: {
          titulo: dto.titulo,
          puntajeTotal: dto.puntajeTotal,
          preguntas: {
            create: dto.preguntas.map((p) => ({
              enunciado: p.enunciado,
              respuestaEsperada: p.respuestaEsperada,
              puntajeMaximo: p.puntajeMaximo,
              criteriosIA: p.criteriosIA || null,
              esEvaluacionVisual: p.esEvaluacionVisual ?? false,
            })),
          },
        },
      });
    });
  }

  async deleteExamen(id: string) {
    const examen = await this.prisma.examen.findUnique({ where: { id } });
    if (!examen)
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);

    await this.prisma.examen.delete({
      where: { id },
    });
    return { success: true };
  }

  async duplicateExamen(id: string, cursoDestinoId?: string) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: { preguntas: true },
    });
    if (!examen)
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);

    const newCursoId = cursoDestinoId || examen.cursoId;

    return this.prisma.examen.create({
      data: {
        titulo: `Copia de ${examen.titulo}`,
        puntajeTotal: examen.puntajeTotal,
        cursoId: newCursoId,
        preguntas: {
          create: examen.preguntas.map((p) => ({
            enunciado: p.enunciado,
            respuestaEsperada: p.respuestaEsperada,
            puntajeMaximo: p.puntajeMaximo,
            criteriosIA: p.criteriosIA,
            esEvaluacionVisual: p.esEvaluacionVisual,
          })),
        },
      },
    });
  }

  /**
   * Regenera una pregunta existente con IA según el tipo de ajuste especificado (sin persistir en BD).
   */
  async regenerarPregunta(dto: RegenerarPreguntaDto) {
    // 1. Validaciones condicionales de parámetros según el tipo de ajuste
    if (
      dto.tipoAjuste === TipoAjuste.CAMBIO_DIFICULTAD &&
      !dto.parametros?.nivelDificultad
    ) {
      throw new BadRequestException(
        'Para el tipo de ajuste CAMBIO_DIFICULTAD debe especificar el parámetro nivelDificultad (FACIL, MEDIO o DIFICIL).',
      );
    }

    if (
      dto.tipoAjuste === TipoAjuste.CAMBIO_FORMATO &&
      !dto.parametros?.formatoDestino
    ) {
      throw new BadRequestException(
        'Para el tipo de ajuste CAMBIO_FORMATO debe especificar el parámetro formatoDestino (MULTIPLE_CHOICE, DESARROLLO o VERDADERO_FALSO).',
      );
    }

    // 2. Buscar la pregunta existente en la base de datos (o usar datos en memoria si se proporcionaron)
    let pregunta = await this.prisma.pregunta.findUnique({
      where: { id: dto.preguntaId },
    });

    if (!pregunta) {
      if (dto.preguntaData?.enunciado && dto.preguntaData?.respuestaEsperada) {
        pregunta = {
          id: dto.preguntaId,
          examenId: 'memoria',
          enunciado: dto.preguntaData.enunciado,
          respuestaEsperada: dto.preguntaData.respuestaEsperada,
          puntajeMaximo: dto.preguntaData.puntajeMaximo ?? 10,
          criteriosIA: dto.preguntaData.criteriosIA ?? null,
          esEvaluacionVisual: dto.preguntaData.esEvaluacionVisual ?? false,
        };
      } else {
        throw new NotFoundException(
          `Pregunta con ID ${dto.preguntaId} no encontrada.`,
        );
      }
    }

    // 3. Solicitar la regeneración a AiService
    const sugerencia = await this.aiService.regenerarPregunta(
      {
        enunciado: pregunta.enunciado,
        respuestaEsperada: pregunta.respuestaEsperada,
        puntajeMaximo: pregunta.puntajeMaximo,
        criteriosIA: pregunta.criteriosIA,
        esEvaluacionVisual: pregunta.esEvaluacionVisual,
      },
      dto.tipoAjuste,
      dto.parametros,
    );

    // 4. Retornar el resultado sin alterar la base de datos
    return {
      preguntaOriginal: {
        id: pregunta.id,
        enunciado: pregunta.enunciado,
        respuestaEsperada: pregunta.respuestaEsperada,
        puntajeMaximo: pregunta.puntajeMaximo,
      },
      sugerencia,
      tipoAjuste: dto.tipoAjuste,
      parametros: dto.parametros,
    };
  }

  /**
   * Obtiene las métricas y diagnóstico pedagógico de un examen.
   */
  async getMetricasExamen(id: string) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: {
        preguntas: true,
        curso: {
          include: {
            alumnos: true,
          },
        },
        entregas: {
          include: {
            correccion: true,
          },
        },
      },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);
    }

    const round1 = (num: number) => Math.round(num * 10) / 10;

    const totalAlumnos = examen.curso?.alumnos?.length ?? 0;
    const preguntas = examen.preguntas || [];
    const puntajeTotalExamen = round1(
      preguntas.reduce((sum, p) => sum + (p.puntajeMaximo || 0), 0),
    );

    const entregasPublicadasList = (examen.entregas || []).filter(
      (e) => e.estado === 'PUBLICADO',
    );
    const entregasPublicadas = entregasPublicadasList.length;

    const notasValidas = entregasPublicadasList
      .map((e) => e.correccion?.notaFinal)
      .filter((nota): nota is number => typeof nota === 'number' && !isNaN(nota));

    let notaPromedio: number | null = null;
    let notaMaxima: number | null = null;
    let notaMinima: number | null = null;
    let porcentajeAprobacion: number | null = null;

    if (notasValidas.length > 0) {
      const sumaNotas = notasValidas.reduce((sum, n) => sum + n, 0);
      notaPromedio = round1(sumaNotas / notasValidas.length);
      notaMaxima = round1(Math.max(...notasValidas));
      notaMinima = round1(Math.min(...notasValidas));

      const umbralAprobacion = 0.6 * puntajeTotalExamen;
      const aprobados = notasValidas.filter((nota) => nota >= umbralAprobacion).length;
      porcentajeAprobacion = round1((aprobados / notasValidas.length) * 100);
    }

    const diagnosticoPorPregunta = preguntas.map((pregunta) => {
      const puntajes: number[] = [];

      if (entregasPublicadas > 0) {
        for (const entrega of entregasPublicadasList) {
          if (!entrega.correccion?.feedbackJSON) continue;
          try {
            const parsed = JSON.parse(entrega.correccion.feedbackJSON);
            let items: any[] = [];
            if (Array.isArray(parsed)) {
              items = parsed;
            } else if (parsed && Array.isArray(parsed.preguntas)) {
              items = parsed.preguntas;
            } else if (parsed && typeof parsed === 'object') {
              items = Object.values(parsed);
            }

            const match = items.find(
              (item) => item && (item.preguntaId === pregunta.id || item.id === pregunta.id),
            );

            if (
              match &&
              typeof match.puntajeObtenido === 'number' &&
              !isNaN(match.puntajeObtenido)
            ) {
              puntajes.push(match.puntajeObtenido);
            }
          } catch {
            // Skipear silenciosamente errores de parseo
          }
        }
      }

      if (puntajes.length === 0) {
        return {
          preguntaId: pregunta.id,
          enunciado: pregunta.enunciado,
          puntajeMaximo: round1(pregunta.puntajeMaximo),
          promedioObtenido: null,
          porcentajeAcierto: null,
          porcentajeError: null,
        };
      }

      const suma = puntajes.reduce((acc, val) => acc + val, 0);
      const promedioObtenido = round1(suma / puntajes.length);
      const porcentajeAcierto =
        pregunta.puntajeMaximo > 0
          ? round1((promedioObtenido / pregunta.puntajeMaximo) * 100)
          : 0;
      const porcentajeError = round1(100 - porcentajeAcierto);

      return {
        preguntaId: pregunta.id,
        enunciado: pregunta.enunciado,
        puntajeMaximo: round1(pregunta.puntajeMaximo),
        promedioObtenido,
        porcentajeAcierto,
        porcentajeError,
      };
    });

    return {
      examenId: examen.id,
      titulo: examen.titulo,
      totalAlumnos,
      entregasPublicadas,
      notaPromedio,
      notaMaxima,
      notaMinima,
      porcentajeAprobacion,
      puntajeTotalExamen,
      diagnosticoPorPregunta,
    };
  }
}
