import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, GeneratedExam } from '../ai/ai.service';
import { EstadoExamenEnum } from './dto/update-estado-examen.dto';
import { IsString, IsNumber, IsArray, IsOptional, IsEnum } from 'class-validator';

export class UpdateExamenDto {
  @IsString()
  @IsOptional()
  titulo?: string;

  @IsNumber()
  @IsOptional()
  puntajeTotal?: number;

  @IsOptional()
  @IsEnum(EstadoExamenEnum)
  estado?: EstadoExamenEnum;

  @IsArray()
  @IsOptional()
  preguntas?: Array<{
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

  async updateEstado(id: string, estado: EstadoExamenEnum) {
    const examen = await this.prisma.examen.findUnique({
      where: { id },
      include: { preguntas: true },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);
    }

    // Validar que el examen tenga preguntas antes de pasar a PUBLICADO
    if (
      estado === EstadoExamenEnum.PUBLICADO &&
      (!examen.preguntas || examen.preguntas.length === 0)
    ) {
      throw new BadRequestException(
        'No se puede publicar un examen que no contiene preguntas.',
      );
    }

    return this.prisma.examen.update({
      where: { id },
      data: { estado },
      include: {
        preguntas: true,
        entregas: true,
        curso: true,
      },
    });
  }

  async updateExamen(id: string, dto: UpdateExamenDto) {
    const examen = await this.prisma.examen.findUnique({ where: { id } });
    if (!examen)
      throw new NotFoundException(`Examen con ID ${id} no encontrado.`);

    return this.prisma.$transaction(async (tx) => {
      if (dto.preguntas) {
        await tx.pregunta.deleteMany({
          where: { examenId: id },
        });
      }

      return tx.examen.update({
        where: { id },
        data: {
          ...(dto.titulo !== undefined && { titulo: dto.titulo }),
          ...(dto.puntajeTotal !== undefined && {
            puntajeTotal: dto.puntajeTotal,
          }),
          ...(dto.estado !== undefined && { estado: dto.estado }),
          ...(dto.preguntas && {
            preguntas: {
              create: dto.preguntas.map((p) => ({
                enunciado: p.enunciado,
                respuestaEsperada: p.respuestaEsperada,
                puntajeMaximo: p.puntajeMaximo,
                criteriosIA: p.criteriosIA || null,
                esEvaluacionVisual: p.esEvaluacionVisual ?? false,
              })),
            },
          }),
        },
        include: {
          preguntas: true,
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
}
