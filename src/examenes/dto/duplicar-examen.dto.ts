import { IsOptional, IsString } from 'class-validator';

export class DuplicarExamenDto {
  @IsOptional()
  @IsString()
  cursoDestinoId?: string;
}
