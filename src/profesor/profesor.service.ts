import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateProfesorDto {
  nombre?: string;
  apellido?: string;
  email?: string;
}

@Injectable()
export class ProfesorService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(id: string, dto: UpdateProfesorDto) {
    const profesor = await this.prisma.profesor.findUnique({ where: { id } });
    if (!profesor) {
      throw new NotFoundException('Profesor no encontrado');
    }
    return this.prisma.profesor.update({
      where: { id },
      data: dto,
    });
  }
}
