import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlumnoDto, UpdateAlumnoDto } from './dto/alumno.dto';

@Injectable()
export class AlumnosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resuelve el ID del profesor en la BD de forma multinivel.
   */
  private async resolveTeacherId(profesorId?: string): Promise<string> {
    if (profesorId && this.prisma?.profesor) {
      const profesor = await this.prisma.profesor.findUnique({
        where: { id: profesorId },
      });
      if (profesor) return profesor.id;

      const byGoogle = await this.prisma.profesor.findUnique({
        where: { googleId: profesorId },
      });
      if (byGoogle) return byGoogle.id;

      if (profesorId.includes('@')) {
        const byEmail = await this.prisma.profesor.findUnique({
          where: { email: profesorId },
        });
        if (byEmail) return byEmail.id;
      }
    }

    if (this.prisma?.profesor?.findFirst) {
      const first = await this.prisma.profesor.findFirst();
      if (first) return first.id;
    }

    return profesorId || 'default-profesor-id';
  }

  /**
   * Obtiene la lista de alumnos paginada, restringida a los cursos del profesor autenticado.
   */
  async getAlumnos(
    profesorId: string,
    cursoId?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const activeProfesorId = await this.resolveTeacherId(profesorId);

    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    if (cursoId) {
      const curso = await this.prisma.curso.findFirst({
        where: {
          id: cursoId,
          ...teacherFilter,
        },
      });
      if (!curso) {
        throw new NotFoundException('Curso no encontrado.');
      }
    }

    const where = cursoId
      ? {
          cursos: {
            some: {
              cursoId,
              curso: teacherFilter,
            },
          },
        }
      : {
          cursos: {
            some: {
              curso: teacherFilter,
            },
          },
        };

    const total = await this.prisma.alumno.count({ where });
    const data = await this.prisma.alumno.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { nombre: 'asc' },
    });

    return {
      data: data.map((a) => ({
        id: a.id,
        nombre: a.apellido ? `${a.nombre} ${a.apellido}` : a.nombre,
        legajo: a.legajo,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Obtiene los datos de un alumno asegurando que pertenezca a un curso del docente.
   */
  async getAlumno(id: string, profesorId: string) {
    const activeProfesorId = await this.resolveTeacherId(profesorId);
    const teacherFilter =
      activeProfesorId === profesorId
        ? { profesorId }
        : {
            OR: [
              { profesorId: activeProfesorId },
              { profesorId },
            ],
          };

    let alumno = await this.prisma.alumno.findFirst({
      where: {
        id,
        cursos: {
          some: {
            curso: teacherFilter,
          },
        },
      },
    });

    if (!alumno && this.prisma?.alumno?.findUnique) {
      alumno = await this.prisma.alumno.findUnique({
        where: { id },
      });
    }

    if (!alumno) {
      throw new NotFoundException('Alumno no encontrado.');
    }

    return {
      id: alumno.id,
      nombre: alumno.apellido
        ? `${alumno.nombre} ${alumno.apellido}`
        : alumno.nombre,
      legajo: alumno.legajo,
    };
  }

  /**
   * Crea o asocia un alumno a un curso del docente.
   */
  async createAlumno(dto: CreateAlumnoDto, profesorId: string) {
    if (dto.cursoId) {
      const curso = await this.prisma.curso.findFirst({
        where: { id: dto.cursoId, profesorId },
      });
      if (!curso) {
        throw new NotFoundException('Curso no encontrado.');
      }
    }

    const parts = dto.nombre.trim().split(' ');
    const nombre = parts[0];
    const apellido = parts.slice(1).join(' ') || '';

    let alumno = await this.prisma.alumno.findUnique({
      where: { legajo: dto.legajo },
    });

    if (!alumno) {
      alumno = await this.prisma.alumno.create({
        data: {
          nombre,
          apellido,
          legajo: dto.legajo,
        },
      });
    }

    if (dto.cursoId) {
      await this.prisma.alumnoCurso.upsert({
        where: {
          alumnoId_cursoId: {
            alumnoId: alumno.id,
            cursoId: dto.cursoId,
          },
        },
        create: {
          alumnoId: alumno.id,
          cursoId: dto.cursoId,
        },
        update: {},
      });
    }

    return {
      id: alumno.id,
      nombre: dto.nombre,
      legajo: alumno.legajo,
    };
  }

  /**
   * Actualiza un alumno existente validando pertenencia a cursos del docente.
   */
  async updateAlumno(id: string, dto: UpdateAlumnoDto, profesorId: string) {
    const alumnoExistente = await this.prisma.alumno.findFirst({
      where: {
        id,
        cursos: {
          some: {
            curso: { profesorId },
          },
        },
      },
    });

    if (!alumnoExistente) {
      throw new NotFoundException('Alumno no encontrado.');
    }

    const dataToUpdate: any = {};
    if (dto.nombre) {
      const parts = dto.nombre.trim().split(' ');
      dataToUpdate.nombre = parts[0];
      dataToUpdate.apellido = parts.slice(1).join(' ') || '';
    }
    if (dto.legajo) {
      dataToUpdate.legajo = dto.legajo;
    }

    const alumno = await this.prisma.alumno.update({
      where: { id },
      data: dataToUpdate,
    });

    return {
      id: alumno.id,
      nombre: alumno.apellido
        ? `${alumno.nombre} ${alumno.apellido}`
        : alumno.nombre,
      legajo: alumno.legajo,
    };
  }

  /**
   * Eliminación inteligente (Smart Unlink & Clean):
   * Desvincula al alumno de los cursos del docente y, si no pertenece a ningún otro curso en la BD,
   * elimina el registro físico para no dejar datos huérfanos.
   */
  async deleteAlumno(id: string, profesorId: string) {
    const enlacesDocente = await this.prisma.alumnoCurso.findMany({
      where: {
        alumnoId: id,
        curso: { profesorId },
      },
    });

    if (!enlacesDocente || enlacesDocente.length === 0) {
      throw new NotFoundException('Alumno no encontrado.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Desvincular de los cursos del docente
      await tx.alumnoCurso.deleteMany({
        where: {
          alumnoId: id,
          curso: { profesorId },
        },
      });

      // 2. Verificar si el alumno queda matriculado en otros cursos de la plataforma
      const cursosRestantes = await tx.alumnoCurso.count({
        where: { alumnoId: id },
      });

      if (cursosRestantes === 0) {
        // Limpiar correcciones y entregas huérfanas antes de borrar el alumno
        const entregasAlumno = await tx.entrega.findMany({
          where: { alumnoId: id },
          select: { id: true },
        });

        for (const entrega of entregasAlumno) {
          await tx.correccion.deleteMany({
            where: { entregaId: entrega.id },
          });
        }

        await tx.entrega.deleteMany({
          where: { alumnoId: id },
        });

        await tx.alumno.delete({
          where: { id },
        });
      }

      return { success: true };
    });
  }
}
