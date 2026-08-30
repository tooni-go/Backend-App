import { Module } from '@nestjs/common';
import { ProfesorController } from './profesor.controller';
import { ProfesorService } from './profesor.service';
import { PrismaService } from '../prisma/prisma.service'; // Adjust path if PrismaModule exists

@Module({
  controllers: [ProfesorController],
  providers: [ProfesorService, PrismaService],
  exports: [ProfesorService],
})
export class ProfesorModule {}
