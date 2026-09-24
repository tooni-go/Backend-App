import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePreguntaItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty({ message: 'El enunciado de la pregunta es obligatorio' })
  enunciado!: string;

  @IsString()
  @IsNotEmpty({ message: 'La respuesta esperada de la pregunta es obligatoria' })
  respuestaEsperada!: string;

  @IsNumber({}, { message: 'puntajeMaximo debe ser un número' })
  puntajeMaximo!: number;

  @IsOptional()
  @IsString()
  criteriosIA?: string;

  @IsOptional()
  @IsBoolean()
  esEvaluacionVisual?: boolean;

  @IsOptional()
  @IsNumber()
  orden?: number;
}

export class UpdateExamenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El título no puede estar vacío' })
  titulo?: string;

  @IsOptional()
  @IsString()
  fecha?: string;

  @IsOptional()
  @IsNumber()
  puntajeTotal?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePreguntaItemDto)
  preguntas?: UpdatePreguntaItemDto[];
}
