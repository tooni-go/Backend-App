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

  @IsOptional()
  @IsString()
  departamento?: string;
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
      if (!profesor) {
        throw new NotFoundException('Profesor no encontrado.');
      }
      return profesor;
    }
    return this.getOrCreateDefaultProfesor();
  }

  async updateProfile(dto: UpdateProfesorDto, id?: string) {
    let targetId = id;
    if (targetId) {
      const profesor = await this.prisma.profesor.findUnique({ where: { id: targetId } });
      if (!profesor) {
        throw new NotFoundException('Profesor no encontrado.');
      }
    } else {
      const defaultProf = await this.getOrCreateDefaultProfesor();
      targetId = defaultProf.id;
    }

    const dataToUpdate: { nombre?: string; apellido?: string; email?: string } = {};
    if (dto.nombre !== undefined) dataToUpdate.nombre = dto.nombre;
    if (dto.apellido !== undefined) dataToUpdate.apellido = dto.apellido;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    return this.prisma.profesor.update({
      where: { id: targetId },
      data: dataToUpdate,
    });
  }
}