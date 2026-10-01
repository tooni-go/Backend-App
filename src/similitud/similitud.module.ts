import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SimilitudService } from './similitud.service';

@Module({
  imports: [PrismaModule],
  providers: [SimilitudService],
  exports: [SimilitudService],
})
export class SimilitudModule {}
