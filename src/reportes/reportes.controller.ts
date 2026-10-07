import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Reportes')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller(['api/v1/reportes', 'reportes'])
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /**
   * Exporta las calificaciones de un examen específico en formato CSV.
   */
  @Get('examen/:examenId/csv')
  @ApiOperation({ summary: 'Exportar notas de examen a CSV' })
  @ApiParam({ name: 'examenId', description: 'ID del examen' })
  @ApiResponse({ status: 200, description: 'Archivo CSV descargado.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  async getExamenCsv(
    @Param('examenId') examenId: string,
    @CurrentUser('id') profesorId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer, content } =
      await this.reportesService.generateExamenCsv(examenId, profesorId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer || content);
  }

  /**
   * Exporta las calificaciones de un examen específico en formato PDF.
   */
  @Get('examen/:examenId/pdf')
  @ApiOperation({ summary: 'Exportar notas de examen a PDF' })
  @ApiParam({ name: 'examenId', description: 'ID del examen' })
  @ApiResponse({ status: 200, description: 'Archivo PDF descargado.' })
  @ApiResponse({ status: 404, description: 'Examen no encontrado.' })
  async getExamenPdf(
    @Param('examenId') examenId: string,
    @CurrentUser('id') profesorId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.reportesService.generateExamenPdf(examenId, profesorId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /**
   * Exporta las calificaciones consolidadas de un curso en formato CSV.
   */
  @Get('curso/:cursoId/csv')
  @ApiOperation({ summary: 'Exportar notas consolidadas de curso a CSV' })
  @ApiParam({ name: 'cursoId', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Archivo CSV descargado.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async getCursoCsv(
    @Param('cursoId') cursoId: string,
    @CurrentUser('id') profesorId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer, content } =
      await this.reportesService.generateCursoCsv(cursoId, profesorId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer || content);
  }

  /**
   * Exporta las calificaciones consolidadas de un curso en formato PDF.
   */
  @Get('curso/:cursoId/pdf')
  @ApiOperation({ summary: 'Exportar notas consolidadas de curso a PDF' })
  @ApiParam({ name: 'cursoId', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Archivo PDF descargado.' })
  @ApiResponse({ status: 404, description: 'Curso no encontrado.' })
  async getCursoPdf(
    @Param('cursoId') cursoId: string,
    @CurrentUser('id') profesorId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } =
      await this.reportesService.generateCursoPdf(cursoId, profesorId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}