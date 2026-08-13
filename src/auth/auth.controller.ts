import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Autenticación')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión o registrar profesor mediante Google ID Token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: {
          type: 'string',
          description: 'Token ID recibido de Google tras el flujo OAuth del frontend',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión iniciada correctamente. Retorna el JWT de EvalIA.',
  })
  @ApiResponse({
    status: 401,
    description: 'Token de Google inválido, expirado o denegado.',
  })
  async login(@Body('token') token: string) {
    return this.authService.loginWithGoogle(token);
  }
}
