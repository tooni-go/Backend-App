import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  CursosService,
  CreateCursoDto,
  UpdateCursoDto,
} from './cursos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Cursos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller(['api/v1/cursos', 'cursos'])
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo curso asociado al profesor autenticado',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['materia', 'anio', 'division', 'anioLectivo'],
      properties: {
        materia: { type: 'string', example: 'Matemática' },
        anio: { type: 'number', example: 5 },
        division: { type: 'string', example: 'A' },
        anioLectivo: { type: 'number', example: 2026 },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Curso creado exitosamente.' })
  @ApiResponse({
    status: 401,
    description: 'No autorizado (token JWT faltante o expirado).',
  })
  async createCurso(
    @Body() body: CreateCursoDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.createCurso(body, profesorId);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los cursos vinculados al profesor autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de cursos retornada con éxito.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getCursos(@CurrentUser('id') profesorId: string) {
    return this.cursosService.getCursos(profesorId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        materia: { type: 'string', example: 'Matemática Avanzada' },
        anio: { type: 'number', example: 6 },
        division: { type: 'string', example: 'B' },
        anioLectivo: { type: 'number', example: 2027 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Curso actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async updateCurso(
    @Param('id') id: string,
    @Body() body: UpdateCursoDto,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.updateCurso(id, body, profesorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Curso eliminado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async deleteCurso(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.deleteCurso(id, profesorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Detalle del curso retornado con éxito.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async getCurso(
    @Param('id') id: string,
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.getCurso(id, profesorId);
  }

  @Post(':id/alumnos')
  @ApiOperation({ summary: 'Registrar un alumno y asociarlo al curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombre', 'apellido', 'legajo'],
      properties: {
        nombre: { type: 'string', example: 'Juan' },
        apellido: { type: 'string', example: 'Pérez' },
        legajo: { type: 'string', example: 'L-12345' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Alumno registrado e inscrito exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async registerStudent(
    @Param('id') cursoId: string,
    @Body() body: { nombre: string; apellido: string; legajo: string },
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.addAlumnoToCurso(cursoId, body, profesorId);
  }

  @Post(':id/examenes')
  @ApiOperation({ summary: 'Crear un nuevo examen para un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['titulo', 'puntajeTotal', 'preguntas'],
      properties: {
        titulo: { type: 'string', example: 'Examen de Álgebra' },
        puntajeTotal: { type: 'number', example: 10 },
        preguntas: {
          type: 'array',
          items: {
            type: 'object',
            required: ['enunciado', 'respuestaEsperada', 'puntajeMaximo'],
            properties: {
              enunciado: { type: 'string', example: '¿Cuánto es 2 + 2?' },
              respuestaEsperada: { type: 'string', example: '4' },
              puntajeMaximo: { type: 'number', example: 5 },
              criteriosIA: {
                type: 'string',
                example: 'Explicación detallada',
                nullable: true,
              },
              esEvaluacionVisual: {
                type: 'boolean',
                example: false,
                default: false,
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Examen y preguntas creados exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async createExam(
    @Param('id') cursoId: string,
    @Body()
    body: {
      titulo: string;
      puntajeTotal: number;
      preguntas: Array<{
        enunciado: string;
        respuestaEsperada: string;
        puntajeMaximo: number;
        criteriosIA?: string;
        esEvaluacionVisual?: boolean;
      }>;
    },
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.createExamen(cursoId, body, profesorId);
  }

  @Post(':id/alumnos/importar-masivo')
  @ApiOperation({ summary: 'Importar múltiples alumnos masivamente desde CSV/Excel a un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        alumnos: {
          type: 'array',
          items: {
            type: 'object',
            required: ['nombre', 'apellido', 'legajo'],
            properties: {
              nombre: { type: 'string', example: 'Ana' },
              apellido: { type: 'string', example: 'García' },
              legajo: { type: 'string', example: 'L-99999' },
              email: { type: 'string', example: 'ana@example.com' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Reporte de la importación masiva.',
  })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async importStudentsMassive(
    @Param('id') cursoId: string,
    @Body() body: { alumnos: Array<{ nombre: string; apellido: string; legajo: string; email?: string }> },
    @CurrentUser('id') profesorId: string,
  ) {
    return this.cursosService.importarAlumnosMasivo(cursoId, body.alumnos, profesorId);
  }
}
