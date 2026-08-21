import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Registrar filtro global para errores de carga de archivos (Multer)
  app.useGlobalFilters(new MulterExceptionFilter());

  // Resolver la carpeta de uploads de manera configurable y consistente entre dev y prod
  const customUploadsDir = process.env.UPLOADS_DIR;
  const uploadsDir = customUploadsDir
    ? (customUploadsDir.startsWith('/') ? customUploadsDir : join(process.cwd(), customUploadsDir))
    : join(process.cwd(), 'uploads');

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
