import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Optional,
  InternalServerErrorException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamenesService } from './examenes.service';
import { SimilitudService } from '../similitud/similitud.service';
import { UpdateEstadoExamenDto } from './dto/update-estado-examen.dto';
import { GeneratedExam } from '../ai/ai.service';
import { RegenerarPreguntaDto } from './dto/regenerar-pregunta.dto';
import { UpdateExamenDto } from './dto/update-examen.dto';
import { DuplicarExamenDto } from './dto/duplicar-examen.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Exámenes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller(['api/v1/examenes', 'examenes'])
export class ExamenesController {
  constructor(
    private readonly examenesService: ExamenesService,
    @Optional() private readonly similitudService?: SimilitudService,
  ) {}

  @Get(':id/similitud')
  @ApiOperation({ summary: 'Obtener análisis de similitud del examen' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async getSimilitudExamen(@Param('id') id: string) {
    if (!this.similitudService) {
      throw new InternalServerErrorException(
        'SimilitudService no está disponible en este contexto.',
      );
    }
    return this.similitudService.analizarSimilitudExamen(id);
  }

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
  @ApiResponse({ status: 200, description: 'Métricas del examen obtenidas exitosamente.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  async getMetricasExamen(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.getMetricasExamen(id, profesorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un examen' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  @ApiResponse({ status: 200, description: 'Detalle del examen retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  async getExamen(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.getExamen(id, profesorId);
  }

  /**
   * Actualiza el examen y sus preguntas asociadas.
   */
  @Put(':id')
  @ApiOperation({ summary: 'Editar un examen y sus preguntas' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  @ApiResponse({ status: 200, description: 'Examen actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateExamen(
    @Param('id') id: string,
    @Body() dto: UpdateExamenDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.updateExamen(id, dto, profesorId);
  }

  @Patch(':id/estado')
  @ApiOperation({
    summary: 'Actualizar el estado del examen (BORRADOR, PUBLICADO, ARCHIVADO)',
  })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  @ApiResponse({
    status: 200,
    description: 'Estado del examen actualizado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No se puede publicar un examen sin preguntas o estado inválido.',
  })
  @ApiResponse({
    status: 404,
    description: 'Examen no encontrado.',
  })
  async updateEstado(
    @Param('id') id: string,
    @Body() body: UpdateEstadoExamenDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.updateEstado(id, body.estado, profesorId);
  }

  /**
   * Elimina un examen y sus recursos asociados en cascada.
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un examen y sus preguntas/entregas en cascada',
  })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  @ApiResponse({ status: 200, description: 'Examen eliminado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  async deleteExamen(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.deleteExamen(id, profesorId);
  }

  /**
   * Duplica un examen y sus preguntas a un curso de destino.
   */
  @Post(':id/duplicar')
  @ApiOperation({ summary: 'Duplicar un examen' })
  @ApiParam({ name: 'id', description: 'ID del examen a duplicar' })
  @ApiResponse({ status: 201, description: 'Examen duplicado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Examen o curso de destino no encontrado.' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async duplicarExamen(
    @Param('id') id: string,
    @Body() dto: DuplicarExamenDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.examenesService.duplicarExamen(id, dto, profesorId);
  }
}