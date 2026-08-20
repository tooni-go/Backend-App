import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError, HttpException)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const maxMb = process.env.MAX_UPLOAD_SIZE_MB || '10';

    if (exception instanceof MulterError) {
      let message = `Error al procesar el archivo: ${exception.message}`;
      if (exception.code === 'LIMIT_FILE_SIZE') {
        message = `El archivo excede el tamaño máximo permitido de ${maxMb}MB.`;
      }
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Bad Request',
      });
    }

    if (exception instanceof HttpException) {
      const status: number = exception.getStatus();
      if (status === 413) {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: `El archivo excede el tamaño máximo permitido de ${maxMb}MB.`,
          error: 'Bad Request',
        });
      }
      return response.status(status).json(exception.getResponse());
    }

    return response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Error al procesar el archivo adjunto.',
      error: 'Bad Request',
    });
  }
}
