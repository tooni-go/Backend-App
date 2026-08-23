import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class CreateAlumnoDto {
  @ApiProperty({ example: 'Juan Perez', description: 'Nombre completo del alumno' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @ApiProperty({ example: '38123456', description: 'DNI / Legajo del alumno (7 u 8 dígitos numéricos)' })
  @IsNumberString({}, { message: 'El DNI / Legajo debe contener solo números' })
  @Length(7, 8, { message: 'El DNI / Legajo debe tener 7 u 8 números' })
  legajo: string;

  @ApiProperty({ description: 'ID del curso al que se asocia el alumno' })
  @IsString({ message: 'El cursoId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El cursoId es obligatorio' })
  cursoId: string;
}

export class UpdateAlumnoDto {
  @ApiPropertyOptional({ example: 'Juan Perez', description: 'Nombre completo del alumno' })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  nombre?: string;

  @ApiPropertyOptional({ example: '38123456', description: 'DNI / Legajo del alumno (7 u 8 dígitos numéricos)' })
  @IsOptional()
  @IsNumberString({}, { message: 'El DNI / Legajo debe contener solo números' })
  @Length(7, 8, { message: 'El DNI / Legajo debe tener 7 u 8 números' })
  legajo?: string;
}
