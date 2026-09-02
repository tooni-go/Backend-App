import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateCursoDto {
  materia: string;
  anio: number;
  division: string;
  anioLectivo: number;
}

export class UpdateCursoDto {
  materia?: string;
  anio?: number;
  division?: string;
  anioLectivo?: number;
}

export class RegisterAlumnoDto {
  nombre: string;
  apellido: string;
  legajo: string;
}

export class CreateExamenDto {
  titulo: string;
  puntajeTotal: number;
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
   * Resuelve el ID del profesor o usa uno por defecto (para MVP local).
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
    return teacher.id;
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
    const cursos = await this.prisma.curso.findMany({
      where: { profesorId },
      include: {
        examenes: true,
        _count: {
          select: { alumnos: true },
        },
      },
    });
    
    return cursos.map(c => ({
      id: c.id,
      materia: c.materia,
      anio: c.anio,
      division: c.division,
      anioLectivo: c.anioLectivo,
      alumnosCount: c._count.alumnos,
      examenes: c.examenes.map(e => ({
        id: e.id,
        titulo: e.titulo,
        fecha: e.fecha,
        estado: 'ACTIVO',
      }))
    }));
  }

  /**
   * Actualiza un curso existente.
   */
  async updateCurso(id: string, dto: UpdateCursoDto, headerTeacherId?: string) {
    const profesorId = await this.resolveTeacherId(headerTeacherId);
    const curso = await this.prisma.curso.findUnique({ where: { id } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.profesorId !== profesorId) throw new ForbiddenException('No tienes permiso para editar este curso');

    return this.prisma.curso.update({
      where: { id },
      data: {
        ...(dto.materia && { materia: dto.materia }),
        ...(dto.anio && { anio: dto.anio }),
        ...(dto.division && { division: dto.division }),
        ...(dto.anioLectivo && { anioLectivo: dto.anioLectivo }),
      }
    });
  }

  /**
   * Elimina un curso.
   */
  async deleteCurso(id: string, headerTeacherId?: string) {
    const profesorId = await this.resolveTeacherId(headerTeacherId);
    const curso = await this.prisma.curso.findUnique({ where: { id } });
    if (!curso) throw new NotFoundException('Curso no encontrado');
    if (curso.profesorId !== profesorId) throw new ForbiddenException('No tienes permiso para eliminar este curso');

    await this.prisma.curso.delete({ where: { id } });
    return { success: true };
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
        puntajeTotal: dto.puntajeTotal,
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


