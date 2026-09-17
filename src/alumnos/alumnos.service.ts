import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlumnoDto, UpdateAlumnoDto } from './dto/alumno.dto';

@Injectable()
export class AlumnosService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlumnos(cursoId?: string, page: number = 1, limit: number = 10) {
    const where = cursoId ? { cursos: { some: { cursoId } } } : {};

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

  async getAlumno(id: string) {
    const alumno = await this.prisma.alumno.findUnique({ where: { id } });
    if (!alumno) throw new NotFoundException('El alumno no existe.');
    return {
      id: alumno.id,
      nombre: alumno.apellido
        ? `${alumno.nombre} ${alumno.apellido}`
        : alumno.nombre,
      legajo: alumno.legajo,
    };
  }

  async createAlumno(dto: CreateAlumnoDto) {
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

  async updateAlumno(id: string, dto: UpdateAlumnoDto) {
    const alumnoExistente = await this.prisma.alumno.findUnique({
      where: { id },
    });
    if (!alumnoExistente) throw new NotFoundException('El alumno no existe.');

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

  async deleteAlumno(id: string) {
    try {
      await this.prisma.alumno.delete({ where: { id } });
      return { success: true };
    } catch (e) {
      throw new NotFoundException('El alumno no existe.');
    }
  }
}
