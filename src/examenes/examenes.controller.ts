import {
  Controller,
  Get,
  Post,
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

@Controller('api/v1/examenes')
export class ExamenesController {
  constructor(private readonly examenesService: ExamenesService) {}

  /**
   * Endpoint de Carga Inteligente de Exámenes.
   * Acepta tanto JSON ({ texto: string }) como multipart/form-data con archivo (PDF/imagen/TXT) y/o texto.
   */
  @Post('generar')
  @UseInterceptors(FileInterceptor('file'))
  async generateExam(
    @UploadedFile() file?: Express.Multer.File,
    @Body('texto') textoFromForm?: string,
    @Body() bodyJson?: { texto?: string },
  ): Promise<GeneratedExam> {
    const texto = textoFromForm || bodyJson?.texto;
    return this.examenesService.generateExam({
      texto,
      file,
    });
  }

  /**
   * Endpoint de regeneración atómica de una consigna individual con IA.
   */
  @Post('preguntas/regenerar-individual')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async regenerarPregunta(@Body() dto: RegenerarPreguntaDto) {
    return this.examenesService.regenerarPregunta(dto);
  }

  /**
   * Obtiene las métricas y diagnóstico pedagógico de un examen.
   */
  @Get(':id/metricas')
  async getMetricasExamen(@Param('id') id: string) {
    return this.examenesService.getMetricasExamen(id);
  }

  /**
   * Obtiene el detalle de un examen específico con sus preguntas y el curso con sus alumnos anidados.
   */
  @Get(':id')
  async getExamen(@Param('id') id: string) {
    return this.examenesService.getExamen(id);
  }
}
