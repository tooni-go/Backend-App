import { Controller, Put, Get, Body, UseGuards, Req } from '@nestjs/common';
import { ProfesorService, UpdateProfesorDto } from './profesor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Profesor')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/profesor')
export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del profesor autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente.' })
  async getProfile(@Req() req: any) {
    return this.profesorService.getProfile(req.user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Actualizar perfil del profesor autenticado' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', example: 'Carlos' },
        apellido: { type: 'string', example: 'Gomez' },
        email: { type: 'string', example: 'carlos@evalia.com' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async updateProfile(
    @Body() body: UpdateProfesorDto,
    @Req() req: any,
  ) {
    return this.profesorService.updateProfile(req.user.id, body);
  }
}
