import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, GeneratedExam } from '../ai/ai.service';
import { RegenerarPreguntaDto, TipoAjuste } from './dto/regenerar-pregunta.dto';

@Injectable()
export class ExamenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Genera un examen inteligente a partir de consignas en texto o archivo adjunto.
   */
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

  /**
   * Obtiene el detalle de un examen por ID con sus preguntas y el curso con sus alumnos anidados.
   */
  async getExamen(id: string) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: {
        preguntas: true,
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

    // 2. Buscar la pregunta existente en la base de datos
    const pregunta = await this.prisma.pregunta.findUnique({
      where: { id: dto.preguntaId },
    });

    if (!pregunta) {
      throw new NotFoundException(
        `Pregunta con ID ${dto.preguntaId} no encontrada.`,
      );
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
}
