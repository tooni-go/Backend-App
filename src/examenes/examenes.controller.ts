import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamenesService } from './examenes.service';
import { GeneratedExam } from '../ai/ai.service';
import { RegenerarPreguntaDto } from './dto/regenerar-pregunta.dto';
import { UpdateExamenDto } from './dto/update-examen.dto';
import { DuplicarExamenDto } from './dto/duplicar-examen.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Exámenes')
@Controller('api/v1/examenes')
export class ExamenesController {
  constructor(private readonly examenesService: ExamenesService) {}

  @Post('generar')
  @ApiOperation({
    summary: 'Generar examen con IA a partir de texto o archivo',
  })
  @UseInterceptors(FileInterceptor('file'))
  async generateExam(
    @UploadedFile() file?: Express.Multer.File,
    @Body('texto') textoFromForm?: string,
    @Body() bodyJson?: { texto?: string },
  ): Promise<GeneratedExam> {
    const texto = textoFromForm || bodyJson?.texto;
    return this.examenesService.generateExam({ texto, file });
  }

  /**
   * Endpoint de regeneración atómica de una consigna individual con IA.
   */
  @Post('preguntas/regenerar-individual')
  @ApiOperation({
    summary: 'Regeneración atómica de una consigna individual con IA',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async regenerarPregunta(@Body() dto: RegenerarPreguntaDto) {
    return this.examenesService.regenerarPregunta(dto);
  }

  /**
   * Obtiene las métricas y diagnóstico pedagógico de un examen.
   */
  @Get(':id/metricas')
  @ApiOperation({
    summary: 'Obtiene las métricas y diagnóstico pedagógico de un examen',
  })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async getMetricasExamen(@Param('id') id: string) {
    return this.examenesService.getMetricasExamen(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un examen' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async getExamen(@Param('id') id: string) {
    return this.examenesService.getExamen(id);
  }

  /**
   * Actualiza el examen y sus preguntas asociadas.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Editar un examen y sus preguntas' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateExamen(
    @Param('id') id: string,
    @Body() dto: UpdateExamenDto,
  ) {
    return this.examenesService.updateExamen(id, dto);
  }

  /**
   * Elimina un examen y sus recursos asociados en cascada.
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un examen y sus preguntas/entregas en cascada',
  })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async deleteExamen(@Param('id') id: string) {
    return this.examenesService.deleteExamen(id);
  }

  /**
   * Duplica un examen y sus preguntas a un curso de destino.
   */
  @Post(':id/duplicar')
  @ApiOperation({ summary: 'Duplicar un examen' })
  @ApiParam({ name: 'id', description: 'ID del examen a duplicar' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async duplicarExamen(
    @Param('id') id: string,
    @Body() dto: DuplicarExamenDto,
  ) {
    return this.examenesService.duplicarExamen(id, dto);
  }
}