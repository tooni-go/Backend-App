import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EntregasService } from './entregas.service';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Entregas')
@Controller('api/v1/entregas')
export class EntregasController {
  constructor(private readonly entregasService: EntregasService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
    return this.entregasService.approveEntrega(id, body.notaFinal, body.observaciones);
  }
}
