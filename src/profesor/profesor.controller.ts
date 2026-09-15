import { Controller, Get, Put, Body, Headers } from '@nestjs/common';
import { ProfesorService } from './profesor.service';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

@Controller('api/v1/profesor')
export class ProfesorController {
  constructor(private readonly profesorService: ProfesorService) {}

  /**
   * Obtiene los datos de perfil del profesor actual.
   */
  @Get('me')
  async getMe(@Headers('x-teacher-id') teacherId?: string) {
    return this.profesorService.getProfile(teacherId);
  }

  /**
   * Actualiza el perfil (nombre y apellido) del profesor actual.
   */
  @Put('me')
  async updateMe(
    @Body() body: UpdateProfesorDto,
    @Headers('x-teacher-id') teacherId?: string,
  ) {
    return this.profesorService.updateProfile(body, teacherId);
  }
}
