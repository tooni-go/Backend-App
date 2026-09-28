import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateProfesorDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  apellido?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

@Injectable()
export class ProfesorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene o crea el profesor por defecto para entorno local/seed.
   */
  async getOrCreateDefaultProfesor() {
    let profesor = await this.prisma.profesor.findFirst();
    if (!profesor) {
      profesor = await this.prisma.profesor.create({
        data: {
          nombre: 'Profesor',
          apellido: 'Titular',
          email: 'profesor@evalia.com',
          googleId: 'default-google-id',
        },
      });
    }
    return profesor;
  }

  async getProfile(id?: string) {
    if (id) {
      const profesor = await this.prisma.profesor.findUnique({ where: { id } });
      if (profesor) {
        return profesor;
      }
    }
    return this.getOrCreateDefaultProfesor();
  }

  async updateProfile(
    idOrDto: string | UpdateProfesorDto,
    maybeDto?: UpdateProfesorDto,
  ) {
    let id: string;
    let dto: UpdateProfesorDto;

    if (typeof idOrDto === 'string') {
      id = idOrDto;
      dto = maybeDto || {};
      const profesor = await this.prisma.profesor.findUnique({ where: { id } });
      if (!profesor) {
        throw new NotFoundException('Profesor no encontrado');
      }
      return this.prisma.profesor.update({
        where: { id },
        data: dto,
      });
    } else {
      dto = idOrDto || {};
      const firstProf = await this.prisma.profesor.findFirst();
      const defaultProf = firstProf || (await this.getOrCreateDefaultProfesor());
      return this.prisma.profesor.update({
        where: { id: defaultProf.id },
        data: dto,
      });
    }
  }
}