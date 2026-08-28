import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
} from '@nestjs/common';
import { CursosService } from './cursos.service';

@Controller('api/v1/cursos')
export class CursosController {
  constructor(private readonly cursosService: CursosService) {}

  @Post()
  async createCurso(
    @Body() body: { materia: string; anio: number; division: string; anioLectivo: number },
    @Headers('x-teacher-id') teacherId?: string,
  ) {
    return this.cursosService.createCurso(body, teacherId);
  }

  @Get()
  async getCursos(@Headers('x-teacher-id') teacherId?: string) {
    return this.cursosService.getCursos(teacherId);
  }

  @Get(':id')
  async getCurso(@Param('id') id: string) {
    return this.cursosService.getCurso(id);
  }

  @Post(':id/alumnos')
  async registerStudent(
    @Param('id') cursoId: string,
    @Body() body: { nombre: string; apellido: string; legajo: string },
  ) {
    return this.cursosService.addAlumnoToCurso(cursoId, body);
  }

  @Post(':id/examenes')
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
