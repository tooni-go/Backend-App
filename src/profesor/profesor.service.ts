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
  constructor(private prisma: PrismaService) {}

  async getProfile(id: string) {
    const profesor = await this.prisma.profesor.findUnique({ where: { id } });
    if (!profesor) {
      throw new NotFoundException('Profesor no encontrado');
    }
    return profesor;
  }

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