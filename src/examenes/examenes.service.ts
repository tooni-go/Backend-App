import { Injectable } from '@nestjs/common';
import { AiService, GeneratedExam } from '../ai/ai.service';

@Injectable()
export class ExamenesService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Genera un examen inteligente a partir de consignas en texto o archivo adjunto.
   */
  async generateExam(params: {
    texto?: string;
    file?: Express.Multer.File;
  }): Promise<GeneratedExam> {
    return this.aiService.generateExam({
      texto: params.texto,
      fileBuffer: params.file?.buffer,
      mimeType: params.file?.mimetype,
    });
  }
}
