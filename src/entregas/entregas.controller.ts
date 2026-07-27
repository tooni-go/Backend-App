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

@Controller('api/v1/entregas')
export class EntregasController {
  constructor(private readonly entregasService: EntregasService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadEntrega(
    @UploadedFile() file: Express.Multer.File,
    @Body('examId') examId: string,
    @Body('alumnoId') alumnoId: string,
  ) {
    return this.entregasService.createEntrega(examId, alumnoId, file);
  }

  @Get(':id')
  async getEntrega(@Param('id') id: string) {
    return this.entregasService.getEntrega(id);
  }

  @Put(':id/aprobar')
  async approveEntrega(
    @Param('id') id: string,
    @Body() body: { notaFinal: number; observaciones?: string },
  ) {
    return this.entregasService.approveEntrega(id, body.notaFinal, body.observaciones);
  }
}
