import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiResilienceService } from './ai-resilience.service';
import { AiController } from './ai.controller';

@Module({
  controllers: [AiController],
  providers: [AiService, AiResilienceService],
  exports: [AiService, AiResilienceService],
})
export class AiModule {}
