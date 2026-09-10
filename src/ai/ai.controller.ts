import {
  Controller,
  Get,
  Patch,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { AiResilienceService } from './ai-resilience.service';
import { AiService } from './ai.service';

export interface UpdateAiModelDto {
  modelo: string;
}

@Controller('api/v1/ai')
export class AiController {
  constructor(
    private readonly aiResilienceService: AiResilienceService,
    private readonly aiService: AiService,
  ) {}

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

  /**
   * Obtiene la configuración actual del modelo de IA de respaldo (OpenRouter)
   * incluyendo el modelo activo, su origen (memoria vs env) y el catálogo homologado.
   */
  @Get('model')
  getModelConfig() {
    return this.aiService.getOpenRouterConfig();
  }

  @Get('config')
  getConfigAlias() {
    return this.aiService.getOpenRouterConfig();
  }

  /**
   * Actualiza dinámicamente en tiempo de ejecución el modelo de respaldo de OpenRouter.
   */
  @Patch('model')
  updateModel(@Body() body: UpdateAiModelDto) {
    if (
      !body ||
      typeof body.modelo !== 'string' ||
      body.modelo.trim().length === 0
    ) {
      throw new BadRequestException(
        'El campo "modelo" es obligatorio y debe ser una cadena de texto no vacía.',
      );
    }
    return this.aiService.setActiveOpenRouterModel(body.modelo.trim());
  }
}
