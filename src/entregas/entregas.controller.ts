import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EntregasService } from './entregas.service';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

@ApiTags('Entregas')
@Controller('api/v1/entregas')
export class EntregasController {
  constructor(private readonly entregasService: EntregasService) {}

  /**
   * Carga de una nueva entrega con archivo adjunto y disparo de corrección en segundo plano.
   */
  @Post()
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Subir archivo de entrega de examen e iniciar corrección por IA en segundo plano' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['examId', 'alumnoId', 'file'],
      properties: {
        examId: {
          type: 'string',
          description: 'ID del examen asociado',
        },
        alumnoId: {
          type: 'string',
          description: 'ID del alumno',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de la entrega (JPG, PNG, WEBP, PDF)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Entrega subida de forma exitosa y corrección iniciada en background.',
  })
  @ApiResponse({
    status: 404,
    description: 'Examen o alumno asociado no encontrado.',
  })
  async uploadEntrega(
    @UploadedFile() file: Express.Multer.File,
    @Body('examId') examId: string,
    @Body('alumnoId') alumnoId: string,
  ) {
    return this.entregasService.createEntrega(examId, alumnoId, file);
  }

  /**
   * Lista entregas filtradas por examenId o por alumnoId.
   */
  @Get()
  async getEntregas(
    @Query('examenId') examenId?: string,
    @Query('alumnoId') alumnoId?: string,
  ) {
    return this.entregasService.getEntregas({ examenId, alumnoId });
  }

  /**
   * Obtiene el detalle de una entrega específica con su estado y corrección.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener los detalles, estado y corrección de una entrega' })
  @ApiParam({ name: 'id', description: 'ID único de la entrega' })
  @ApiResponse({
    status: 200,
    description: 'Información de la entrega y su respectiva sugerencia de la IA.',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrega no encontrada.',
  })
  async getEntrega(@Param('id') id: string) {
    return this.entregasService.getEntrega(id);
  }

  /**
   * Aprueba la calificación final de la entrega por parte del docente.
   */
  @Put(':id/aprobar')
  @ApiOperation({ summary: 'Aprobar y guardar la nota definitiva del examen' })
  @ApiParam({ name: 'id', description: 'ID de la entrega a aprobar' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['notaFinal'],
      properties: {
        notaFinal: {
          type: 'number',
          description: 'Nota definitiva dada por el profesor',
          example: 8.5,
        },
        observaciones: {
          type: 'string',
          description: 'Feedback u observaciones generales',
          example: 'Buen intento, se corrigió precisión.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Calificación guardada y estado actualizado a PUBLICADO.',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrega no encontrada.',
  })
  async approveEntrega(
    @Param('id') id: string,
    @Body() body: { notaFinal: number; observaciones?: string },
  ) {
    return this.entregasService.approveEntrega(
      id,
      body.notaFinal,
      body.observaciones,
    );
  }
}
