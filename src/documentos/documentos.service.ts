import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { AiService } from '../ai/ai.service';
import {
  ExtraerTextoResponseDto,
  FuenteTipo,
} from './dto/extraer-texto-response.dto';

export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class DocumentosService {
  private readonly logger = new Logger(DocumentosService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Extrae el texto crudo de un archivo subido (TXT, DOCX, PDF, JPG, PNG, WEBP).
   * Para TXT y DOCX la extracción es determinística y exacta (sin IA).
   * Para PDF e imágenes se emplea visión e IA con transcripción literal fiel.
   */
  async extractText(
    file?: Express.Multer.File,
  ): Promise<ExtraerTextoResponseDto> {
    // 1. Validar presencia del archivo y buffer
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Debe proporcionar un archivo para la extracción de texto.',
      );
    }

    // 2. Validar tipo MIME soportado
    if (!SUPPORTED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo '${file.mimetype}' no soportado para extracción. Formatos permitidos: TXT, DOCX, PDF, JPG, PNG, WEBP.`,
      );
    }

    // 3. Validar tamaño máximo permitido
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

    let textoExtraido = '';
    let fuenteTipo: FuenteTipo;
    let requiereRevision = false;

    // 4. Procesamiento según tipo de archivo
    switch (file.mimetype) {
      case 'text/plain': {
        this.logger.log('Extrayendo texto de archivo TXT plano...');
        textoExtraido = file.buffer.toString('utf-8').trim();
        fuenteTipo = 'txt';
        requiereRevision = false;
        break;
      }

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
        this.logger.log(
          'Extrayendo texto determinístico de archivo DOCX con mammoth...',
        );
        try {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          textoExtraido = (result.value || '').trim();
          fuenteTipo = 'docx';
          requiereRevision = false;
        } catch (error: unknown) {
          const errMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Error al procesar archivo DOCX con mammoth: ${errMessage}`,
          );
          throw new BadRequestException(
            'No se pudo leer el archivo DOCX provisto. Asegúrese de que el documento no esté dañado.',
          );
        }
        break;
      }

      case 'application/pdf': {
        this.logger.log('Extrayendo texto de archivo PDF mediante IA...');
        textoExtraido = await this.aiService.extractTextFromDocument(
          file.buffer,
          file.mimetype,
        );
        fuenteTipo = 'pdf';
        requiereRevision = true;
        break;
      }

      case 'image/jpeg':
      case 'image/jpg':
      case 'image/png':
      case 'image/webp': {
        this.logger.log(
          `Extrayendo texto de imagen (${file.mimetype}) mediante IA...`,
        );
        textoExtraido = await this.aiService.extractTextFromDocument(
          file.buffer,
          file.mimetype,
        );
        fuenteTipo = 'imagen';
        requiereRevision = true;
        break;
      }

      default:
        throw new BadRequestException(
          `Tipo de archivo '${file.mimetype}' no soportado.`,
        );
    }

    // 5. Manejo de documentos sin texto reconocible
    if (!textoExtraido) {
      this.logger.warn(
        `No se detectó texto reconocible en el archivo subido (${file.originalname || file.mimetype}).`,
      );
      return {
        textoExtraido: '',
        fuenteTipo,
        requiereRevision: true,
      };
    }

    return {
      textoExtraido,
      fuenteTipo,
      requiereRevision,
    };
  }
}
