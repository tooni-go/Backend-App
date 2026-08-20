import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlumnoDto {
  @ApiProperty({ example: 'Juan Perez' })
  nombre: string;

  @ApiProperty({ example: 'L-12345' })
  legajo: string;

  @ApiProperty({ description: 'ID del curso al que se asocia el alumno' })
  cursoId: string;
}

export class UpdateAlumnoDto {
  @ApiPropertyOptional({ example: 'Juan Perez' })
  nombre?: string;

  @ApiPropertyOptional({ example: 'L-12345' })
  legajo?: string;
}
