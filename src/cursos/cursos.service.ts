import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';

export class CreateCursoDto {
  @IsString()
  @IsNotEmpty()
  materia: string;

  @IsNumber()
  @IsNotEmpty()
  anio: number;

  @IsString()
  @IsNotEmpty()
  division: string;

  @IsNumber()
  @IsNotEmpty()
  anioLectivo: number;
}

export class UpdateCursoDto {
  @IsOptional()
  @IsString()
  materia?: string;

  @IsOptional()
  @IsNumber()
  anio?: number;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsNumber()
  anioLectivo?: number;
}

export class RegisterAlumnoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  apellido: string;

  @IsString()
  @IsNotEmpty()
  legajo: string;
}

export class CreateExamenDto {
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsNumber()
  @IsNotEmpty()
  puntajeTotal: number;

  @IsArray()
  @IsNotEmpty()
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
   * Crea un nuevo curso asociado al profesor autenticado.
   */
  async createCurso(dto: CreateCursoDto, profesorId: string) {
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
   * Obtiene todos los cursos asociados al profesor autenticado.
   */
  async getCursos(profesorId: string) {
    const cursos = await this.prisma.curso.findMany({
      where: { profesorId },
      include: {
        examenes: true,
        _count: {
          select: { alumnos: true },
        },
      },
    });

    return cursos.map((c) => ({
      id: c.id,
      materia: c.materia,
      anio: c.anio,
      division: c.division,
      anioLectivo: c.anioLectivo,
      alumnosCount: c._count.alumnos,
      examenes: c.examenes.map((e) => ({
        id: e.id,
        titulo: e.titulo,
        fecha: e.fecha,
        estado: e.estado,
      })),
    }));
  }

  /**
   * Actualiza un curso existente perteneciente al profesor autenticado.
   */
  async updateCurso(id: string, dto: UpdateCursoDto, profesorId: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id, profesorId },
    });
    if (!curso) throw new NotFoundException('Curso no encontrado.');

    return this.prisma.curso.update({
      where: { id },
      data: {
        ...(dto.materia && { materia: dto.materia }),
        ...(dto.anio && { anio: dto.anio }),
        ...(dto.division && { division: dto.division }),
        ...(dto.anioLectivo && { anioLectivo: dto.anioLectivo }),
      },
    });
  }

  /**
   * Elimina un curso perteneciente al profesor autenticado.
   */
  async deleteCurso(id: string, profesorId: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id, profesorId },
    });
    if (!curso) throw new NotFoundException('Curso no encontrado.');

    await this.prisma.curso.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Obtiene un curso por ID con sus exámenes y alumnos, validando pertenencia al profesor autenticado.
   */
  async getCurso(cursoId: string, profesorId: string) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, profesorId },
      include: {
        examenes: {
          include: {
            preguntas: true,
            _count: { select: { entregas: true } },
          },
          orderBy: { fecha: 'desc' },
        },
        alumnos: {
          include: { alumno: true },
        },
      },
    });
    if (!curso) {
      throw new NotFoundException(`Curso no encontrado.`);
    }
    return curso;
  }

  /**
   * Registra un alumno y lo asocia con un curso del profesor autenticado.
   */
  async addAlumnoToCurso(
    cursoId: string,
    dto: RegisterAlumnoDto,
    profesorId: string,
  ) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, profesorId },
    });
    if (!curso) {
      throw new NotFoundException(`Curso no encontrado.`);
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
   * Crea un examen para un curso perteneciente al profesor autenticado.
   */
  async createExamen(
    cursoId: string,
    dto: CreateExamenDto,
    profesorId: string,
  ) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, profesorId },
    });
    if (!curso) {
      throw new NotFoundException(`Curso no encontrado.`);
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

  /**
   * Importa alumnos masivamente a un curso del profesor autenticado.
   */
  async importarAlumnosMasivo(
    cursoId: string,
    alumnos: Array<{ nombre: string; apellido: string; legajo: string; email?: string }>,
    profesorId: string,
  ) {
    const curso = await this.prisma.curso.findFirst({
      where: { id: cursoId, profesorId },
    });
    if (!curso) {
      throw new NotFoundException(`Curso no encontrado.`);
    }

    let procesados = 0;
    const errores: any[] = [];

    for (const [index, a] of alumnos.entries()) {
      try {
        let alumno = await this.prisma.alumno.findUnique({
          where: { legajo: a.legajo },
        });

        if (alumno) {
          alumno = await this.prisma.alumno.update({
            where: { id: alumno.id },
            data: { nombre: a.nombre, apellido: a.apellido, email: a.email },
          });
        } else {
          alumno = await this.prisma.alumno.create({
            data: {
              nombre: a.nombre,
              apellido: a.apellido,
              legajo: a.legajo,
              email: a.email,
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
        procesados++;
      } catch (error: any) {
        errores.push({ fila: index + 1, legajo: a.legajo, error: error.message });
      }
    }

    return {
      totalRecibidos: alumnos.length,
      procesados,
      errores,
    };
  }
}
