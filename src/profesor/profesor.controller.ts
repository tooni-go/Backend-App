import { Controller, Put, Get, Body, UseGuards } from '@nestjs/common';
import { ProfesorService, UpdateProfesorDto } from './profesor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Profesor')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller(['api/v1/profesor', 'profesor'])
export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del profesor autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Profesor no encontrado.' })
  async getMe(@CurrentUser('id') profesorId: string) {
    return this.profesorService.getProfile(profesorId);
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
  @ApiResponse({ status: 404, description: 'Profesor no encontrado.' })
  async updateMe(
    @Body() body: UpdateProfesorDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.profesorService.updateProfile(body, profesorId);
  }
}
