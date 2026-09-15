import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoAjuste {
  CAMBIO_DIFICULTAD = 'CAMBIO_DIFICULTAD',
  CAMBIO_FORMATO = 'CAMBIO_FORMATO',
  REFRASEO = 'REFRASEO',
}

export enum NivelDificultad {
  FACIL = 'FACIL',
  MEDIO = 'MEDIO',
  DIFICIL = 'DIFICIL',
}

export enum FormatoDestino {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  DESARROLLO = 'DESARROLLO',
  VERDADERO_FALSO = 'VERDADERO_FALSO',
}

export class ParametrosRegeneracionDto {
  @IsOptional()
  @IsEnum(NivelDificultad, {
    message: 'nivelDificultad debe ser uno de: FACIL, MEDIO, DIFICIL',
  })
  nivelDificultad?: NivelDificultad;

  @IsOptional()
  @IsEnum(FormatoDestino, {
    message:
      'formatoDestino debe ser uno de: MULTIPLE_CHOICE, DESARROLLO, VERDADERO_FALSO',
  })
  formatoDestino?: FormatoDestino;
}

export class PreguntaDataDto {
  @IsOptional()
  @IsString()
  enunciado?: string;

  @IsOptional()
  @IsString()
  respuestaEsperada?: string;

  @IsOptional()
  @IsNumber()
  puntajeMaximo?: number;

  @IsOptional()
  @IsString()
  criteriosIA?: string;

  @IsOptional()
  @IsBoolean()
  esEvaluacionVisual?: boolean;
}

export class RegenerarPreguntaDto {
  @IsString({ message: 'preguntaId debe ser un texto' })
  @IsNotEmpty({ message: 'preguntaId es obligatorio' })
  preguntaId!: string;

  @IsEnum(TipoAjuste, {
    message:
      'tipoAjuste debe ser uno de: CAMBIO_DIFICULTAD, CAMBIO_FORMATO, REFRASEO',
  })
  @IsNotEmpty({ message: 'tipoAjuste es obligatorio' })
  tipoAjuste!: TipoAjuste;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParametrosRegeneracionDto)
  parametros?: ParametrosRegeneracionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreguntaDataDto)
  preguntaData?: PreguntaDataDto;
}

