import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum EstadoExamenEnum {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  ARCHIVADO = 'ARCHIVADO',
}

export class UpdateEstadoExamenDto {
  @ApiProperty({
    enum: EstadoExamenEnum,
    description: 'Nuevo estado del examen (BORRADOR, PUBLICADO o ARCHIVADO)',
    example: EstadoExamenEnum.PUBLICADO,
  })
  @IsEnum(EstadoExamenEnum, {
    message:
      'El estado debe ser uno de los siguientes valores: BORRADOR, PUBLICADO, ARCHIVADO',
  })
  @IsNotEmpty({ message: 'El campo estado es requerido.' })
  estado: EstadoExamenEnum;
}
