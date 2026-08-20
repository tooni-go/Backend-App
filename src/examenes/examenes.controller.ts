import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamenesService } from './examenes.service';
import { GeneratedExam } from '../ai/ai.service';

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
}
