import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'isNotPastDate', async: false })
export class IsNotPastDateConstraint implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if (!text) return true;
    let parsedFecha: Date;
    if (text.includes('/')) {
      const parts = text.split('/');
      parsedFecha = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    } else {
      parsedFecha = new Date(text);
    }
    if (isNaN(parsedFecha.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsedFecha >= today;
  }

  defaultMessage(args: ValidationArguments) {
    return 'No se puede planificar un examen en el pasado';
  }
}

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
  @Validate(IsNotPastDateConstraint)
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
