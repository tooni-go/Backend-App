import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentosService } from './documentos.service';
import { ExtraerTextoResponseDto } from './dto/extraer-texto-response.dto';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

@ApiTags('Documentos')
@Controller('api/v1/documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  /**
   * Endpoint de extracción de texto de documentos e imágenes.
   * Acepta multipart/form-data con el campo 'file'.
   * Retorna el texto crudo extraído, el tipo de fuente detectado y si requiere revisión.
   */
  @Post('extraer-texto')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  @ApiOperation({
    summary:
      'Extraer texto de un documento o imagen para revisión previa a la generación de examen',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo a procesar (TXT, DOCX, PDF, JPG, PNG, WEBP). Máximo permitido: 10MB.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Texto extraído exitosamente.',
    type: ExtraerTextoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Archivo ausente, formato no soportado o tamaño máximo excedido.',
  })
  async extraerTexto(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ExtraerTextoResponseDto> {
    return this.documentosService.extractText(file);
  }
}
