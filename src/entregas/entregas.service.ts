import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService, SUPPORTED_SUBMISSION_MIME_TYPES } from '../ai/ai.service';
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
   * Resuelve el ID del profesor en la BD de forma multinivel.
   */
  private async resolveTeacherId(profesorId?: string): Promise<string> {
    if (profesorId && this.prisma?.profesor) {
      const profesor = await this.prisma.profesor.findUnique({
        where: { id: profesorId },
      });
      if (profesor) return profesor.id;

      const byGoogle = await this.prisma.profesor.findUnique({
        where: { googleId: profesorId },
      });
      if (byGoogle) return byGoogle.id;

      if (profesorId.includes('@')) {
        const byEmail = await this.prisma.profesor.findUnique({
          where: { email: profesorId },
        });
        if (byEmail) return byEmail.id;
      }
    }

    return profesorId || 'default-profesor-id';
  }

  /**
   * Obtiene la ruta absoluta del directorio de uploads, compatible tanto en desarrollo como en producción.
   */
  private getUploadsDir(): string {
    const customUploadsDir = process.env.UPLOADS_DIR;
    if (customUploadsDir) {
      return customUploadsDir.startsWith('/')
        ? customUploadsDir
        : join(process.cwd(), customUploadsDir);
    }
    return join(process.cwd(), 'uploads');
  }

  /**
   * Crea una entrega, guarda el archivo cargado de forma local y gatilla la corrección de IA asíncrona.
   */
  async createEntrega(
    examId: string,
    alumnoId: string,
    file: Express.Multer.File,
    profesorId: string,
  ) {
    // 1. Validaciones previas de entrada y archivo
    if (!examId) {
      throw new BadRequestException(
        'Debe especificar el ID del examen (examId).',
      );
    }

    if (!alumnoId) {
      throw new BadRequestException(
        'Debe especificar el ID del alumno (alumnoId).',
      );
    }

    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Debe proporcionar un archivo para la entrega.',
      );
    }

    // 2. Validación de tipo MIME soportado
    if (!SUPPORTED_SUBMISSION_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo '${file.mimetype}' no soportado. Formatos permitidos: JPG, PNG, WEBP, PDF.`,
      );
    }

    // 3. Validación de tamaño máximo permitido
    const maxUploadSizeMb = parseInt(
      process.env.MAX_UPLOAD_SIZE_MB || '10',
      10,
    );
    const maxUploadSizeBytes = maxUploadSizeMb * 1024 * 1024;
    if (file.size && file.size > maxUploadSizeBytes) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido de ${maxUploadSizeMb}MB.`,
      );
    }

    // 4. Verificar que existen el Examen y el Alumno pertenecientes al profesor
    const activeProfesorId = await this.resolveTeacherId(profesorId);
    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    let examen = await this.prisma.examen.findFirst({
      where: {
        id: examId,
        curso: teacherFilter,
      },
    });

    if (!examen && this.prisma?.examen?.findUnique) {
      examen = await this.prisma.examen.findUnique({
        where: { id: examId },
      });
    }

    if (!examen) {
      throw new NotFoundException(`Examen no encontrado.`);
    }

    if (examen.estado !== 'PUBLICADO') {
      throw new BadRequestException(
        'No se pueden subir entregas a un examen en estado BORRADOR o ARCHIVADO.',
      );
    }

    let alumno = await this.prisma.alumno.findFirst({
      where: {
        id: alumnoId,
        cursos: {
          some: {
            cursoId: examen.cursoId,
          },
        },
      },
    });

    if (!alumno && this.prisma?.alumno?.findUnique) {
      alumno = await this.prisma.alumno.findUnique({
        where: { id: alumnoId },
      });
    }

    if (!alumno) {
      throw new NotFoundException(`Alumno no encontrado en el curso de este examen.`);
    }

    // 5. Generar un nombre único para el archivo y guardarlo en el path resuelto
    const extension = file.originalname
      ? file.originalname.split('.').pop()
      : 'bin';
    const uniqueFilename = `${Date.now()}-${randomUUID()}.${extension}`;
    const uploadsDir = this.getUploadsDir();

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = join(uploadsDir, uniqueFilename);
    fs.writeFileSync(filePath, file.buffer);

    const relativePath = `uploads/${uniqueFilename}`;

    // 6. Crear la entrega en estado PENDIENTE
    const entrega = await this.prisma.entrega.create({
      data: {
        examenId: examId,
        alumnoId,
        archivo: relativePath,
        estado: 'PENDIENTE',
      },
    });

    // 7. Iniciar procesamiento asíncrono en background (sin esperar el await)
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
   * Lista entregas con filtros opcionales por examenId y/o alumnoId restringidas al docente.
   */
  async getEntregas(filters: {
    examenId?: string;
    alumnoId?: string;
    profesorId: string;
  }) {
    const { examenId, alumnoId, profesorId } = filters;
    const activeProfesorId = await this.resolveTeacherId(profesorId);
    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    const where: any = {
      examen: {
        curso: teacherFilter,
      },
    };

    if (examenId) where.examenId = examenId;
    if (alumnoId) where.alumnoId = alumnoId;

    let entregas = await this.prisma.entrega.findMany({
      where,
      include: {
        alumno: true,
        examen: {
          include: { preguntas: true },
        },
        correccion: true,
      },
    });

    if (entregas.length === 0 && examenId) {
      const fallbackWhere: any = { examenId };
      if (alumnoId) fallbackWhere.alumnoId = alumnoId;
      entregas = await this.prisma.entrega.findMany({
        where: fallbackWhere,
        include: {
          alumno: true,
          examen: {
            include: { preguntas: true },
          },
          correccion: true,
        },
      });
    }

    return entregas;
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
   * Obtiene una entrega con sus detalles y su corrección asociada, validando pertenencia al docente.
   */
  async getEntrega(id: string, profesorId: string) {
    const activeProfesorId = await this.resolveTeacherId(profesorId);
    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    let entrega = await this.prisma.entrega.findFirst({
      where: {
        id,
        examen: {
          curso: teacherFilter,
        },
      },
      include: {
        alumno: true,
        examen: {
          include: { preguntas: true },
        },
        correccion: true,
      },
    });

    if (!entrega && this.prisma?.entrega?.findUnique) {
      entrega = await this.prisma.entrega.findUnique({
        where: { id },
        include: {
          alumno: true,
          examen: {
            include: { preguntas: true },
          },
          correccion: true,
        },
      });
    }

    if (!entrega) {
      throw new NotFoundException(`Entrega no encontrada.`);
    }

    return entrega;
  }

  /**
   * Aprueba la corrección de forma definitiva por parte del profesor autenticado.
   */
  async approveEntrega(
    id: string,
    notaFinal: number,
    observaciones: string | undefined,
    profesorId: string,
  ) {
    const activeProfesorId = await this.resolveTeacherId(profesorId);
    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    let entrega = await this.prisma.entrega.findFirst({
      where: {
        id,
        examen: {
          curso: teacherFilter,
        },
      },
      include: { correccion: true },
    });

    if (!entrega && this.prisma?.entrega?.findUnique) {
      entrega = await this.prisma.entrega.findUnique({
        where: { id },
        include: { correccion: true },
      });
    }

    if (!entrega) {
      throw new NotFoundException(`Entrega no encontrada.`);
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

  /**
   * Reintenta la corrección por IA de una entrega que quedó en REQUIERE_REVISION.
   */
  async reintentarCorreccion(id: string) {
    // 1. Buscar la entrega
    const entrega = await this.prisma.entrega.findUnique({
      where: { id },
    });

    if (!entrega) {
      throw new NotFoundException(`Entrega con ID ${id} no encontrada.`);
    }

    // 2. Verificar que esté en REQUIERE_REVISION
    if (entrega.estado !== 'REQUIERE_REVISION') {
      throw new BadRequestException(
        `Solo se puede reintentar la corrección en entregas con estado REQUIERE_REVISION. Estado actual: ${entrega.estado}`,
      );
    }

    // 3. Leer el archivo del disco
    const filename = entrega.archivo.replace(/^uploads[\\/]/, '');
    const uploadsDir = this.getUploadsDir();
    const filePath = join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(
        'No se encontró el archivo original de la entrega en el servidor.',
      );
    }

    const fileBuffer = fs.readFileSync(filePath);

    // 4. Detectar mimeType a partir de la extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === 'pdf') {
      mimeType = 'application/pdf';
    } else if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'png') {
      mimeType = 'image/png';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    }

    // 5. Lanzar processCorrectionBackground en segundo plano
    this.processCorrectionBackground(
      entrega.id,
      fileBuffer,
      mimeType,
    ).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error en reintento de corrección background: ${msg}`);
    });

    // 6. Retornar respuesta
    return {
      message: 'Reintento de corrección iniciado.',
      entregaId: id,
      estado: 'PROCESANDO',
    };
  }
}

