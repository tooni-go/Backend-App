import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfesorController } from './profesor.controller';
import { ProfesorService } from './profesor.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfesorController],
  providers: [ProfesorService],
  exports: [ProfesorService],
})
export class ProfesorModule {}
