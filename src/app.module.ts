import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { CursosModule } from './cursos/cursos.module';
import { EntregasModule } from './entregas/entregas.module';
import { AuthModule } from './auth/auth.module';
import { AlumnosModule } from './alumnos/alumnos.module';
import { ExamenesModule } from './examenes/examenes.module';

@Module({
  imports: [
    AiModule,
    PrismaModule,
    CursosModule,
    EntregasModule,
    AuthModule,
    AlumnosModule,
    ExamenesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
