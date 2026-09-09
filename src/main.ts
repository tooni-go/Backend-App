import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Registrar filtro global para errores de carga de archivos (Multer)
  app.useGlobalFilters(new MulterExceptionFilter());

  // Validaciones globales usando class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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

  // Configuración de Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EvalIA API')
    .setDescription('Documentación interactiva de la API de EvalIA')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Introduce tu token JWT de EvalIA',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/api/docs`);
}
void bootstrap();
