import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CursosService } from './cursos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';

@ApiTags('Cursos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('api/v1/cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo curso asociado al profesor autenticado' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombre', 'materia'],
      properties: {
        nombre: { type: 'string', example: 'Matemática 5° A' },
        materia: { type: 'string', example: 'Matemática' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Curso creado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado (token JWT faltante o expirado).' })
  async createCurso(
    @Body() body: { nombre: string; materia: string },
    @Req() req: any,
  ) {
    return this.cursosService.createCurso(body, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los cursos vinculados al profesor autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de cursos retornada con éxito.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getCursos(@Req() req: any) {
    return this.cursosService.getCursos(req.user.id);
  }

  @Get(':id')
  async getCurso(@Param('id') id: string) {
    return this.cursosService.getCurso(id);
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
  @ApiResponse({ status: 201, description: 'Alumno registrado e inscrito exitosamente.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async registerStudent(
    @Param('id') cursoId: string,
    @Body() body: { nombre: string; apellido: string; legajo: string },
  ) {
    return this.cursosService.addAlumnoToCurso(cursoId, body);
  }

  @Post(':id/examenes')
  @ApiOperation({ summary: 'Crear un nuevo examen para un curso' })
  @ApiParam({ name: 'id', description: 'ID del curso' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['titulo', 'preguntas'],
      properties: {
        titulo: { type: 'string', example: 'Examen de Álgebra' },
        preguntas: {
          type: 'array',
          items: {
            type: 'object',
            required: ['enunciado', 'respuestaEsperada', 'puntajeMaximo'],
            properties: {
              enunciado: { type: 'string', example: '¿Cuánto es 2 + 2?' },
              respuestaEsperada: { type: 'string', example: '4' },
              puntajeMaximo: { type: 'number', example: 5 },
              criteriosIA: { type: 'string', example: 'Explicación detallada', nullable: true },
              esEvaluacionVisual: { type: 'boolean', example: false, default: false },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Examen y preguntas creados exitosamente.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async createExam(
    @Param('id') cursoId: string,
    @Body() body: {
      titulo: string;
      preguntas: Array<{
        enunciado: string;
        respuestaEsperada: string;
        puntajeMaximo: number;
        criteriosIA?: string;
        esEvaluacionVisual?: boolean;
      }>;
    },
  ) {
    return this.cursosService.createExamen(cursoId, body);
  }
}
