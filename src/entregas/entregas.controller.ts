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
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';

const MAX_UPLOAD_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10);
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

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
  async getEntrega(@Param('id') id: string) {
    return this.entregasService.getEntrega(id);
  }

  /**
   * Aprueba la calificación final de la entrega por parte del docente.
   */
  @Put(':id/aprobar')
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
