import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, GeneratedExam } from '../ai/ai.service';

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
}
