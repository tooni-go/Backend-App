import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Endpoint de monitoreo para consultar las métricas de uso y salud de los proveedores de IA.
   */
  @Get('metrics')
  getMetrics() {
    return this.aiService.getMetrics();
  }
}
