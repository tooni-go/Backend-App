import { Module } from '@nestjs/common';
import { ExamenesController } from './examenes.controller';
import { ExamenesService } from './examenes.service';
import { AiModule } from '../ai/ai.module';
import { SimilitudModule } from '../similitud/similitud.module';

@Module({
  imports: [AiModule, SimilitudModule],
  controllers: [ExamenesController],
  providers: [ExamenesService],
  exports: [ExamenesService],
})
export class ExamenesModule {}
