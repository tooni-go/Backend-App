import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateCursoDto {
  materia: string;
  anio: number;
  division: string;
  anioLectivo: number;
}

interface RegisterAlumnoDto {
  nombre: string;
  apellido: string;
  legajo: string;
}

interface CreateExamenDto {
  titulo: string;
  preguntas: Array<{
    enunciado: string;
    respuestaEsperada: string;
    puntajeMaximo: number;
    criteriosIA?: string | null;
    esEvaluacionVisual?: boolean;
  }>;
}

@Injectable()
export class CursosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene o crea un profesor por defecto para simplificar las pruebas locales del MVP.
   */
  async getOrCreateDefaultTeacher() {
    let teacher = await this.prisma.profesor.findFirst();
    if (!teacher) {
      teacher = await this.prisma.profesor.create({
        data: {
          nombre: 'Profesor',
          apellido: 'Default',
          email: 'default@evalia.com',
          googleId: 'default-google-id',
        },
      });
    }
    return teacher;
  }

  /**
   * Resuelve el ID del profesor basándose en el header x-teacher-id o usando el profesor default.
   */
  async resolveTeacherId(headerTeacherId?: string): Promise<string> {
    if (headerTeacherId) {
      const teacher = await this.prisma.profesor.findUnique({
        where: { id: headerTeacherId },
      });
      if (teacher) {
        return teacher.id;
      }
    }
    const defaultTeacher = await this.getOrCreateDefaultTeacher();
    return defaultTeacher.id;
  }

  /**
   * Crea un nuevo curso asociado a un profesor.
   */
  async createCurso(dto: CreateCursoDto, headerTeacherId?: string) {
    const profesorId = await this.resolveTeacherId(headerTeacherId);
    return this.prisma.curso.create({
      data: {
        materia: dto.materia,
        anio: dto.anio,
        division: dto.division,
        anioLectivo: dto.anioLectivo,
        profesorId,
      },
    });
  }

  /**
   * Obtiene todos los cursos asociados a un profesor.
   */
  async getCursos(headerTeacherId?: string) {
    const profesorId = await this.resolveTeacherId(headerTeacherId);
    return this.prisma.curso.findMany({
      where: { profesorId },
      include: {
        alumnos: {
          include: {
            alumno: true,
          },
        },
        _count: {
          select: { examenes: true },
        },
      },
    });
  }

  /**
   * Registra un alumno y lo asocia con un curso.
   */
  async addAlumnoToCurso(cursoId: string, dto: RegisterAlumnoDto) {
    const curso = await this.prisma.curso.findUnique({
      where: { id: cursoId },
    });
    if (!curso) {
      throw new NotFoundException(`Curso con ID ${cursoId} no encontrado.`);
    }

    // Buscamos si el alumno ya existe por legajo, o lo creamos
    let alumno = await this.prisma.alumno.findUnique({
      where: { legajo: dto.legajo },
    });

    if (!alumno) {
      alumno = await this.prisma.alumno.create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          legajo: dto.legajo,
        },
      });
    }

    // Asociamos el alumno al curso mediante upsert en AlumnoCurso (join table explícita)
    await this.prisma.alumnoCurso.upsert({
      where: {
        alumnoId_cursoId: {
          alumnoId: alumno.id,
          cursoId,
        },
      },
      create: {
        alumnoId: alumno.id,
        cursoId,
      },
      update: {},
    });

    return alumno;
  }

  /**
   * Crea un examen para un curso junto con todas sus preguntas.
   */
  async createExamen(cursoId: string, dto: CreateExamenDto) {
    const curso = await this.prisma.curso.findUnique({
      where: { id: cursoId },
    });
    if (!curso) {
      throw new NotFoundException(`Curso con ID ${cursoId} no encontrado.`);
    }

    return this.prisma.examen.create({
      data: {
        titulo: dto.titulo,
        cursoId,
        preguntas: {
          create: dto.preguntas.map((p) => ({
            enunciado: p.enunciado,
            respuestaEsperada: p.respuestaEsperada,
            puntajeMaximo: p.puntajeMaximo,
            criteriosIA: p.criteriosIA || null,
            esEvaluacionVisual: p.esEvaluacionVisual ?? false,
          })),
        },
      },
      include: {
        preguntas: true,
      },
    });
  }
}
