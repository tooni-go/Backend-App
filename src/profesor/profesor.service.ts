import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfesorDto } from './dto/update-profesor.dto';

@Injectable()
export class ProfesorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene o crea el profesor por defecto para el entorno de desarrollo y MVP.
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

  /**
   * Resuelve el perfil actual del profesor autenticado o el default.
   */
  async getProfile(teacherId?: string) {
    if (teacherId) {
      const profesor = await this.prisma.profesor.findUnique({
        where: { id: teacherId },
      });
      if (profesor) {
        return profesor;
      }
    }
    return this.getOrCreateDefaultProfesor();
  }

  /**
   * Actualiza el perfil (nombre y apellido) del profesor actual.
   */
  async updateProfile(dto: UpdateProfesorDto, teacherId?: string) {
    const current = await this.getProfile(teacherId);

    const dataToUpdate: { nombre?: string; apellido?: string } = {};
    if (dto.nombre !== undefined && dto.nombre.trim() !== '') {
      dataToUpdate.nombre = dto.nombre.trim();
    }
    if (dto.apellido !== undefined && dto.apellido.trim() !== '') {
      dataToUpdate.apellido = dto.apellido.trim();
    }

    return this.prisma.profesor.update({
      where: { id: current.id },
      data: dataToUpdate,
    });
  }
}
