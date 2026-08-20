import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Crear la carpeta uploads si no existe
  const uploadsDir = join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Servir archivos estáticos desde /uploads
  app.useStaticAssets(uploadsDir, {
    prefix: '/uploads/',
  });

  // Habilitar CORS para permitir llamadas desde el frontend
  app.enableCors();

  const port = 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
void bootstrap();
