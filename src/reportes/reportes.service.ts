import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';

export interface ExamenReportData {
  metadata: {
    materia: string;
    division: string;
    anio: number;
    anioLectivo: number;
    tituloExamen: string;
    fechaExamen: string;
    fechaGeneracion: string;
  };
  headers: string[];
  rows: (string | number)[][];
}

export interface CursoReportData {
  metadata: {
    materia: string;
    division: string;
    anio: number;
    anioLectivo: number;
    fechaGeneracion: string;
  };
  headers: string[];
  rows: (string | number)[][];
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitiza componentes para formar un nombre de archivo seguro en headers HTTP.
   */
  sanitizeFilename(
    parts: (string | number | undefined | null)[],
    extension: 'csv' | 'pdf',
  ): string {
    const base = parts
      .filter(
        (p): p is string | number =>
          p !== undefined && p !== null && String(p).trim() !== '',
      )
      .map((p) => String(p).trim())
      .join('-')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar diacríticos/tildes
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_') // Reemplazar caracteres especiales y espacios
      .replace(/_+/g, '_')
      .replace(/^-+|-+$/g, '');

    return `${base}.${extension}`;
  }

  /**
   * Formatea una fecha a formato estándar YYYY-MM-DD.
   */
  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    return d.toISOString().split('T')[0];
  }

  /**
   * Obtiene la estructura de datos para el reporte de un Examen específico.
   */
  async getExamenReportData(examenId: string): Promise<ExamenReportData> {
    const examen = await this.prisma.examen.findUnique({
      where: { id: examenId },
      include: {
        curso: true,
        entregas: {
          include: {
            alumno: true,
            correccion: true,
          },
        },
      },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${examenId} no encontrado.`);
    }

    const headers = [
      'Legajo',
      'Nombre',
      'Apellido',
      'Nota Final',
      'Nivel de Confianza',
      'Fecha de Aprobación',
    ];

    // Ordenar entregas por apellido y nombre de alumno
    const sortedEntregas = [...examen.entregas].sort((a, b) => {
      const apeDiff = (a.alumno?.apellido || '').localeCompare(
        b.alumno?.apellido || '',
      );
      if (apeDiff !== 0) return apeDiff;
      return (a.alumno?.nombre || '').localeCompare(b.alumno?.nombre || '');
    });

    const rows: (string | number)[][] = sortedEntregas.map((entrega) => {
      const legajo = entrega.alumno?.legajo || '-';
      const nombre = entrega.alumno?.nombre || '-';
      const apellido = entrega.alumno?.apellido || '-';

      const isPublicado =
        entrega.estado === 'PUBLICADO' &&
        entrega.correccion !== null &&
        entrega.correccion !== undefined &&
        entrega.correccion.notaFinal !== null &&
        entrega.correccion.notaFinal !== undefined;

      const notaFinal = isPublicado
        ? entrega.correccion!.notaFinal!
        : 'Sin publicar';

      const nivelConfianza = entrega.correccion?.nivelConfianza || '-';

      const fechaAprobacion =
        isPublicado && entrega.correccion?.fechaAprobacion
          ? this.formatDate(entrega.correccion.fechaAprobacion)
          : '-';

      return [
        legajo,
        nombre,
        apellido,
        notaFinal,
        nivelConfianza,
        fechaAprobacion,
      ];
    });

    const todayStr = this.formatDate(new Date());

    return {
      metadata: {
        materia: examen.curso.materia,
        division: examen.curso.division,
        anio: examen.curso.anio,
        anioLectivo: examen.curso.anioLectivo,
        tituloExamen: examen.titulo,
        fechaExamen: this.formatDate(examen.fecha),
        fechaGeneracion: todayStr,
      },
      headers,
      rows,
    };
  }

  /**
   * Obtiene la estructura de datos para el reporte consolidado de un Curso.
   */
  async getCursoReportData(cursoId: string): Promise<CursoReportData> {
    const curso = await this.prisma.curso.findUnique({
      where: { id: cursoId },
      include: {
        alumnos: {
          include: {
            alumno: true,
          },
        },
        examenes: {
          orderBy: { fecha: 'asc' },
          include: {
            entregas: {
              include: {
                correccion: true,
              },
            },
          },
        },
      },
    });

    if (!curso) {
      throw new NotFoundException(`Curso con ID ${cursoId} no encontrado.`);
    }

    const examenesHeaders = curso.examenes.map((e) => e.titulo);
    const headers = ['Legajo', 'Nombre', 'Apellido', ...examenesHeaders, 'Promedio'];

    // Ordenar alumnos por apellido y nombre
    const sortedAlumnos = [...curso.alumnos]
      .map((ac) => ac.alumno)
      .filter((a): a is NonNullable<typeof a> => !!a)
      .sort((a, b) => {
        const apeDiff = a.apellido.localeCompare(b.apellido);
        if (apeDiff !== 0) return apeDiff;
        return a.nombre.localeCompare(b.nombre);
      });

    const rows: (string | number)[][] = sortedAlumnos.map((alumno) => {
      const notasExamenes: (string | number)[] = [];
      const publishedNotas: number[] = [];

      for (const examen of curso.examenes) {
        const entrega = examen.entregas.find((e) => e.alumnoId === alumno.id);
        const isPublicado =
          entrega &&
          entrega.estado === 'PUBLICADO' &&
          entrega.correccion !== null &&
          entrega.correccion !== undefined &&
          entrega.correccion.notaFinal !== null &&
          entrega.correccion.notaFinal !== undefined;

        if (isPublicado) {
          const nota = entrega!.correccion!.notaFinal!;
          notasExamenes.push(nota);
          publishedNotas.push(nota);
        } else {
          notasExamenes.push('Sin publicar');
        }
      }

      let promedio: string | number = 'Sin datos';
      if (publishedNotas.length > 0) {
        const sum = publishedNotas.reduce((acc, val) => acc + val, 0);
        const avg = sum / publishedNotas.length;
        promedio = Number(avg.toFixed(2));
      }

      return [
        alumno.legajo,
        alumno.nombre,
        alumno.apellido,
        ...notasExamenes,
        promedio,
      ];
    });

    const todayStr = this.formatDate(new Date());

    return {
      metadata: {
        materia: curso.materia,
        division: curso.division,
        anio: curso.anio,
        anioLectivo: curso.anioLectivo,
        fechaGeneracion: todayStr,
      },
      headers,
      rows,
    };
  }

  /**
   * Genera el contenido binario de un archivo CSV con BOM UTF-8.
   */
  private generateCsvBuffer(headers: string[], rows: (string | number)[][]): Buffer {
    const records = [headers, ...rows];
    const csvContent = stringify(records);
    const bom = Buffer.from('\uFEFF', 'utf-8');
    const content = Buffer.from(csvContent, 'utf-8');
    return Buffer.concat([bom, content]);
  }

  /**
   * Genera el contenido binario de un archivo PDF usando PDFKit con diseño tabular y paginación.
   */
  private async generatePdfBuffer(options: {
    titulo: string;
    subtitulo: string;
    metadatos: Array<{ label: string; value: string }>;
    headers: string[];
    rows: (string | number)[][];
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#1e3a8a';
      const secondaryColor = '#475569';
      const borderColor = '#cbd5e1';
      const headerBgColor = '#f1f5f9';
      const altRowBgColor = '#f8fafc';

      // Cabecera del documento
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text(options.titulo, { align: 'left' });

      doc.moveDown(0.2);
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor(secondaryColor)
        .text(options.subtitulo, { align: 'left' });

      doc.moveDown(0.4);

      // Metadatos
      doc.fontSize(9).font('Helvetica');
      for (const item of options.metadatos) {
        doc
          .fillColor(secondaryColor)
          .text(`${item.label}: `, { continued: true })
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text(item.value);
      }
      doc.moveDown(0.8);

      // Configuración de tabla
      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colCount = Math.max(options.headers.length, 1);
      const colWidth = pageWidth / colCount;
      const startX = doc.page.margins.left;
      let currentY = doc.y;
      const rowHeight = 22;

      const drawHeader = () => {
        doc.rect(startX, currentY, pageWidth, rowHeight).fill(headerBgColor);
        doc.rect(startX, currentY, pageWidth, rowHeight).stroke(borderColor);

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b');
        options.headers.forEach((header, i) => {
          doc.text(header, startX + i * colWidth + 4, currentY + 6, {
            width: colWidth - 8,
            align: i >= 3 ? 'center' : 'left',
            ellipsis: true,
          });
        });
        currentY += rowHeight;
      };

      drawHeader();

      // Filas de datos
      options.rows.forEach((row, rowIndex) => {
        // Control de salto de página
        if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom - 30) {
          doc.addPage();
          currentY = doc.page.margins.top;
          drawHeader();
        }

        if (rowIndex % 2 === 1) {
          doc.rect(startX, currentY, pageWidth, rowHeight).fill(altRowBgColor);
        }
        doc.rect(startX, currentY, pageWidth, rowHeight).stroke(borderColor);

        doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
        row.forEach((cell, i) => {
          const text = String(cell);
          doc.text(text, startX + i * colWidth + 4, currentY + 6, {
            width: colWidth - 8,
            align: i >= 3 ? 'center' : 'left',
            ellipsis: true,
          });
        });

        currentY += rowHeight;
      });

      if (options.rows.length === 0) {
        doc.rect(startX, currentY, pageWidth, rowHeight).stroke(borderColor);
        doc
          .font('Helvetica-Oblique')
          .fontSize(8.5)
          .fillColor('#64748b')
          .text('Sin registros para mostrar.', startX + 8, currentY + 6);
      }

      // Numeración de páginas y pie en todas las páginas
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#94a3b8')
          .text(
            `EvalIA - Generado el ${new Date().toLocaleDateString('es-AR')} - Página ${i + 1} de ${range.count}`,
            startX,
            doc.page.height - 30,
            { align: 'center', width: pageWidth },
          );
      }

      doc.end();
    });
  }

  /**
   * Genera el reporte CSV de un Examen.
   */
  async generateExamenCsv(
    examenId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getExamenReportData(examenId);
    const filename = this.sanitizeFilename(
      ['notas', data.metadata.materia, data.metadata.division, data.metadata.fechaGeneracion],
      'csv',
    );
    const buffer = this.generateCsvBuffer(data.headers, data.rows);
    return { filename, buffer };
  }

  /**
   * Genera el reporte PDF de un Examen.
   */
  async generateExamenPdf(
    examenId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getExamenReportData(examenId);
    const filename = this.sanitizeFilename(
      ['notas', data.metadata.materia, data.metadata.division, data.metadata.fechaGeneracion],
      'pdf',
    );
    const buffer = await this.generatePdfBuffer({
      titulo: `Reporte de Examen: ${data.metadata.tituloExamen}`,
      subtitulo: `${data.metadata.materia} (${data.metadata.anio}° ${data.metadata.division} - ${data.metadata.anioLectivo})`,
      metadatos: [
        { label: 'Fecha de Examen', value: data.metadata.fechaExamen },
        { label: 'Fecha de Emisión', value: data.metadata.fechaGeneracion },
        { label: 'Cantidad de Entregas', value: String(data.rows.length) },
      ],
      headers: data.headers,
      rows: data.rows,
    });
    return { filename, buffer };
  }

  /**
   * Genera el reporte CSV consolidado de un Curso.
   */
  async generateCursoCsv(
    cursoId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getCursoReportData(cursoId);
    const filename = this.sanitizeFilename(
      ['notas', data.metadata.materia, data.metadata.division, data.metadata.fechaGeneracion],
      'csv',
    );
    const buffer = this.generateCsvBuffer(data.headers, data.rows);
    return { filename, buffer };
  }

  /**
   * Genera el reporte PDF consolidado de un Curso.
   */
  async generateCursoPdf(
    cursoId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getCursoReportData(cursoId);
    const filename = this.sanitizeFilename(
      ['notas', data.metadata.materia, data.metadata.division, data.metadata.fechaGeneracion],
      'pdf',
    );
    const buffer = await this.generatePdfBuffer({
      titulo: `Planilla de Calificaciones - ${data.metadata.materia}`,
      subtitulo: `Curso: ${data.metadata.anio}° ${data.metadata.division} (Ciclo Lectivo ${data.metadata.anioLectivo})`,
      metadatos: [
        { label: 'Fecha de Emisión', value: data.metadata.fechaGeneracion },
        { label: 'Total de Alumnos', value: String(data.rows.length) },
        {
          label: 'Total de Exámenes',
          value: String(Math.max(data.headers.length - 4, 0)),
        },
      ],
      headers: data.headers,
      rows: data.rows,
    });
    return { filename, buffer };
  }
}
