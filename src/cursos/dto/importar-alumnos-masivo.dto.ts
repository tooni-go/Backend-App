import { IsString, IsOptional, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class AlumnoImportDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  apellido: string;

  @ApiProperty({ example: 'L-12345' })
  @IsString()
  legajo: string;

  @ApiProperty({ example: 'juan.perez@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ImportarAlumnosMasivoDto {
  @ApiProperty({ type: [AlumnoImportDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AlumnoImportDto)
  alumnos: AlumnoImportDto[];
}
