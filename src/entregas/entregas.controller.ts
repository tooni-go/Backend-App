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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EntregasService } from './entregas.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

@ApiTags('Entregas')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller(['api/v1/entregas', 'entregas'])
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
  @ApiOperation({
    summary:
      'Subir archivo de entrega de examen e iniciar corrección por IA en segundo plano',
  })
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
    description:
      'Entrega subida de forma exitosa y corrección iniciada en background.',
  })
  @ApiResponse({
    status: 404,
    description: 'Examen o alumno asociado no encontrado.',
  })
  async uploadEntrega(
    @UploadedFile() file: Express.Multer.File,
    @Body('examId') examId: string,
    @Body('alumnoId') alumnoId: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.entregasService.createEntrega(examId, alumnoId, file, profesorId);
  }

  /**
   * Lista entregas filtradas por examenId o por alumnoId pertenecientes al docente.
   */
  @Get()
  @ApiOperation({
    summary: 'Listar entregas del docente autenticado',
  })
  @ApiResponse({ status: 200, description: 'Lista de entregas retornada con éxito.' })
  async getEntregas(
    @CurrentUser('id') profesorId: string,
    @Query('examenId') examenId?: string,
    @Query('alumnoId') alumnoId?: string,
  ) {
    return this.entregasService.getEntregas({ examenId, alumnoId, profesorId });
  }

  /**
   * Obtiene el detalle de una entrega específica con su estado y corrección.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Obtener los detalles, estado y corrección de una entrega',
  })
  @ApiParam({ name: 'id', description: 'ID único de la entrega' })
  @ApiResponse({
    status: 200,
    description:
      'Información de la entrega y su respectiva sugerencia de la IA.',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrega no encontrada.',
  })
  async getEntrega(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.entregasService.getEntrega(id, profesorId);
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
    @CurrentUser('id') profesorId: string,
  ) {
    return this.entregasService.approveEntrega(
      id,
      body.notaFinal,
      body.observaciones,
      profesorId,
    );
  }

  /**
   * Reintenta la corrección por IA de una entrega en estado REQUIERE_REVISION.
   */
  @Post(':id/reintentar-correccion')
  @ApiOperation({
    summary:
      'Reintentar la corrección por IA de una entrega en estado REQUIERE_REVISION',
  })
  @ApiParam({ name: 'id', description: 'ID de la entrega a reintentar' })
  @ApiResponse({
    status: 200,
    description:
      'Corrección iniciada en background. Estado actualizado a PROCESANDO.',
  })
  @ApiResponse({
    status: 400,
    description:
      'La entrega no está en estado REQUIERE_REVISION o falta el archivo.',
  })
  @ApiResponse({ status: 404, description: 'Entrega no encontrada.' })
  async reintentarCorreccion(@Param('id') id: string) {
    return this.entregasService.reintentarCorreccion(id);
  }
}

