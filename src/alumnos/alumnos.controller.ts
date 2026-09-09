import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AlumnosService } from './alumnos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CreateAlumnoDto, UpdateAlumnoDto } from './dto/alumno.dto';

@ApiTags('Alumnos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/alumnos')
export class AlumnosController {
  constructor(private readonly alumnosService: AlumnosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los alumnos con paginación' })
  @ApiQuery({ name: 'cursoId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Lista de alumnos' })
  async getAlumnos(
    @Query('cursoId') cursoId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.alumnosService.getAlumnos(cursoId, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene los detalles de un alumno específico' })
  @ApiResponse({ status: 200, description: 'Detalle del alumno' })
  @ApiResponse({ status: 404, description: 'El alumno no existe' })
  async getAlumno(@Param('id') id: string) {
    return this.alumnosService.getAlumno(id);
  }

  @Post()
  @ApiOperation({ summary: 'Creación de un nuevo alumno' })
  @ApiResponse({ status: 201, description: 'Alumno creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Error en validación de campos' })
  async createAlumno(@Body() dto: CreateAlumnoDto) {
    return this.alumnosService.createAlumno(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualiza los datos de un alumno existente' })
  @ApiResponse({ status: 200, description: 'Alumno actualizado' })
  @ApiResponse({ status: 404, description: 'El alumno no existe' })
  async updateAlumno(@Param('id') id: string, @Body() dto: UpdateAlumnoDto) {
    return this.alumnosService.updateAlumno(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un alumno' })
  @ApiResponse({ status: 200, description: 'Alumno eliminado' })
  @ApiResponse({ status: 404, description: 'El alumno no existe' })
  async deleteAlumno(@Param('id') id: string) {
    return this.alumnosService.deleteAlumno(id);
  }
}
