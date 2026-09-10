import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamenesService, UpdateExamenDto } from './examenes.service';
import { GeneratedExam } from '../ai/ai.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Exámenes')
@Controller('api/v1/examenes')
export class ExamenesController {
  constructor(private readonly examenesService: ExamenesService) {}

  @Post('generar')
  @ApiOperation({
    summary: 'Generar examen con IA a partir de texto o archivo',
  })
  @UseInterceptors(FileInterceptor('file'))
  async generateExam(
    @UploadedFile() file?: Express.Multer.File,
    @Body('texto') textoFromForm?: string,
    @Body() bodyJson?: { texto?: string },
  ): Promise<GeneratedExam> {
    const texto = textoFromForm || bodyJson?.texto;
    return this.examenesService.generateExam({ texto, file });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un examen' })
  async getExamen(@Param('id') id: string) {
    return this.examenesService.getExamen(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar un examen y sus preguntas' })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async updateExamen(@Param('id') id: string, @Body() body: UpdateExamenDto) {
    return this.examenesService.updateExamen(id, body);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un examen y sus preguntas/entregas en cascada',
  })
  @ApiParam({ name: 'id', description: 'ID del examen' })
  async deleteExamen(@Param('id') id: string) {
    return this.examenesService.deleteExamen(id);
  }

  @Post(':id/duplicar')
  @ApiOperation({ summary: 'Duplicar un examen' })
  @ApiParam({ name: 'id', description: 'ID del examen a duplicar' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cursoDestinoId: { type: 'string', example: 'uuid', nullable: true },
      },
    },
  })
  async duplicateExamen(
    @Param('id') id: string,
    @Body() body: { cursoDestinoId?: string },
  ) {
    return this.examenesService.duplicateExamen(id, body.cursoDestinoId);
  }
}
