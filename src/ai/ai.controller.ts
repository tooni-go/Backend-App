import { Controller, Get } from '@nestjs/common';
import { AiResilienceService } from './ai-resilience.service';

@Controller('api/v1/ai')
export class AiController {
  constructor(private readonly aiResilienceService: AiResilienceService) {}

  /**
   * Endpoint de monitoreo para consultar las métricas de uso y salud de los proveedores de IA.
   * Expuesto en español (`/metricas`) y con alias en inglés (`/metrics`) para retrocompatibilidad.
   */
  @Get('metricas')
  getMetricas() {
    return this.aiResilienceService.getMetrics();
  }

  @Get('metrics')
  getMetrics() {
    return this.aiResilienceService.getMetrics();
  }
}
