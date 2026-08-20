import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { join } from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

@Injectable()
export class EntregasService {
  private readonly logger = new Logger(EntregasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Crea una entrega, guarda el archivo cargado de forma local y gatilla la corrección de IA asíncrona.
   */
  async createEntrega(
    examId: string,
    alumnoId: string,
    file: Express.Multer.File,
  ) {
    // Verificar que existen el Examen y el Alumno
    const examen = await this.prisma.examen.findUnique({
      where: { id: examId },
    });
    if (!examen) {
      throw new NotFoundException(`Examen con ID ${examId} no encontrado.`);
    }

    const alumno = await this.prisma.alumno.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno) {
      throw new NotFoundException(`Alumno con ID ${alumnoId} no encontrado.`);
    }

    // Generar un nombre único para el archivo y guardarlo
    const extension = file.originalname.split('.').pop();
    const uniqueFilename = `${Date.now()}-${randomUUID()}.${extension}`;
    const uploadsDir = join(__dirname, '..', '..', 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = join(uploadsDir, uniqueFilename);
    fs.writeFileSync(filePath, file.buffer);

    const relativePath = `uploads/${uniqueFilename}`;

    // Crear la entrega en estado PENDIENTE
    const entrega = await this.prisma.entrega.create({
      data: {
        examenId: examId,
        alumnoId,
        archivo: relativePath,
        estado: 'PENDIENTE',
      },
    });

    // Iniciar procesamiento asíncrono en background (sin esperar el await)
    this.processCorrectionBackground(
      entrega.id,
      file.buffer,
      file.mimetype,
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error en proceso de corrección background: ${msg}`);
    });

    return entrega;
  }

  /**
   * Procesa la corrección en segundo plano (asíncronamente).
   */
  private async processCorrectionBackground(
    entregaId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ) {
    try {
      this.logger.log(
        `[Background] Iniciando corrección para Entrega ID: ${entregaId}`,
      );

      // 1. Actualizar estado a PROCESANDO
      await this.prisma.entrega.update({
        where: { id: entregaId },
        data: { estado: 'PROCESANDO' },
      });

      // 2. Obtener la entrega y las preguntas del examen asociado
      const entrega = await this.prisma.entrega.findUnique({
        where: { id: entregaId },
        include: {
          examen: {
            include: { preguntas: true },
          },
        },
      });

      if (!entrega) {
        throw new Error(`Entrega ID ${entregaId} no encontrada en background.`);
      }

      // Adaptar preguntas a la interfaz requerida por el servicio de IA
      const questionsData = entrega.examen.preguntas.map((q) => ({
        id: q.id,
        enunciado: q.enunciado,
        respuestaEsperada: q.respuestaEsperada,
        puntajeMaximo: q.puntajeMaximo,
        criteriosIA: q.criteriosIA,
        esEvaluacionVisual: q.esEvaluacionVisual,
      }));

      // 3. Evaluar con el servicio de IA
      const { evaluation, finalState } =
        await this.aiService.evaluateSubmission(
          fileBuffer,
          mimeType,
          questionsData,
        );

      // 4. Guardar los resultados en la tabla Corrección si la evaluación tuvo éxito
      if (evaluation) {
        await this.prisma.correccion.upsert({
          where: { entregaId },
          create: {
            entregaId,
            notaIA: evaluation.notaIA,
            nivelConfianza: evaluation.nivelConfianza,
            feedbackJSON: JSON.stringify(evaluation),
          },
          update: {
            notaIA: evaluation.notaIA,
            nivelConfianza: evaluation.nivelConfianza,
            feedbackJSON: JSON.stringify(evaluation),
          },
        });
      }

      // 5. Actualizar el estado final de la entrega
      await this.prisma.entrega.update({
        where: { id: entregaId },
        data: { estado: finalState },
      });

      this.logger.log(
        `[Background] Corrección finalizada para Entrega ID: ${entregaId}. Estado: ${finalState}`,
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Background] Error procesando Entrega ID: ${entregaId}: ${errorMsg}`,
      );

      // En caso de fallo catastrófico, forzar a REQUIERE_REVISION para que el docente pueda ver la entrega.
      await this.prisma.entrega
        .update({
          where: { id: entregaId },
          data: { estado: 'REQUIERE_REVISION' },
        })
        .catch((e: unknown) => {
          const eMsg = e instanceof Error ? e.message : String(e);
          this.logger.error(`No se pudo setear REQUIERE_REVISION: ${eMsg}`);
        });
    }
  }

  /**
   * Obtiene una entrega con sus detalles y su corrección asociada.
   */
  async getEntrega(id: string) {
    const entrega = await this.prisma.entrega.findUnique({
      where: { id },
      include: {
        alumno: true,
        examen: {
          include: { preguntas: true },
        },
        correccion: true,
      },
    });

    if (!entrega) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada.`);
    }

    return entrega;
  }

  /**
   * Aprueba la corrección de forma definitiva por parte del profesor.
   */
  async approveEntrega(id: string, notaFinal: number, observaciones?: string) {
    const entrega = await this.prisma.entrega.findUnique({
      where: { id },
      include: { correccion: true },
    });

    if (!entrega) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada.`);
    }

    const fechaAprobacion = new Date();

    // Actualizar o crear registro de corrección con los valores definidos por el docente
    if (entrega.correccion) {
      const feedbackObj = (
        entrega.correccion.feedbackJSON
          ? JSON.parse(entrega.correccion.feedbackJSON)
          : {}
      ) as Record<string, unknown>;
      feedbackObj.observacionesDocente = observaciones || '';

      await this.prisma.correccion.update({
        where: { id: entrega.correccion.id },
        data: {
          notaFinal,
          fechaAprobacion,
          feedbackJSON: JSON.stringify(feedbackObj),
        },
      });
    } else {
      // Si por alguna razón la IA falló por completo y no se guardó la sugerencia inicial
      const feedbackObj = { observacionesDocente: observaciones || '' };
      await this.prisma.correccion.create({
        data: {
          entregaId: id,
          notaFinal,
          fechaAprobacion,
          feedbackJSON: JSON.stringify(feedbackObj),
        },
      });
    }

    // Actualizar estado de la entrega a PUBLICADO
    return this.prisma.entrega.update({
      where: { id },
      data: { estado: 'PUBLICADO' },
      include: { correccion: true },
    });
  }
}
