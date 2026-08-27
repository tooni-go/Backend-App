import { ApiProperty } from '@nestjs/swagger';

export type FuenteTipo = 'txt' | 'docx' | 'pdf' | 'imagen';

export class ExtraerTextoResponseDto {
  @ApiProperty({
    description: 'Texto transcrito o extraído crudo del documento o imagen adjunta',
    example: 'Examen de Matemática\n1. Resolver la ecuación cuadrática...',
  })
  textoExtraido: string;

  @ApiProperty({
    description: 'Tipo de fuente procesada',
    enum: ['txt', 'docx', 'pdf', 'imagen'],
    example: 'docx',
  })
  fuenteTipo: FuenteTipo;

  @ApiProperty({
    description:
      'Indica si el texto requiere revisión humana (true para PDF/imágenes procesados por IA, false para TXT/DOCX exactos)',
    example: false,
  })
  requiereRevision: boolean;
}
