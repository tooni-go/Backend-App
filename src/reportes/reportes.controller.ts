import {
  Controller,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportesService } from './reportes.service';

@Controller('api/v1/reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('examen/:examenId/csv')
  async getExamenCsv(
    @Param('examenId') examenId: string,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.reportesService.generateExamenCsv(examenId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('examen/:examenId/pdf')
  async getExamenPdf(
    @Param('examenId') examenId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.reportesService.generateExamenPdf(examenId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('curso/:cursoId/csv')
  async getCursoCsv(
    @Param('cursoId') cursoId: string,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.reportesService.generateCursoCsv(cursoId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('curso/:cursoId/pdf')
  async getCursoPdf(
    @Param('cursoId') cursoId: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.reportesService.generateCursoPdf(cursoId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
