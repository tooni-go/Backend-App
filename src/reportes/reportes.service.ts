import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';

/**
 * Sanitiza partes de un nombre de archivo para usar en cabeceras Content-Disposition:
 * 1. Reemplaza tildes y caracteres diacríticos por su equivalente ASCII (á->a, é->e, í->i, ó->o, ú->u, ñ->n).
 * 2. Reemplaza espacios por guiones (-).
 * 3. Remueve cualquier carácter que no sea letra, número o guión.
 * 4. Convierte a minúsculas y normaliza guiones repetidos.
 */
export function sanitizeFilenamePart(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Elimina tildes y diacríticos de un texto para compatibilidad con Excel al abrir CSVs.
 * Preserva espacios, mayúsculas/minúsculas y todos los demás caracteres.
 * Ejemplo: "Martín López" → "Martin Lopez", "Álgebra" → "Algebra"
 */
export function normalizeForCsv(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Genera el nombre de archivo sugerido con el formato: notas-{materia}-{division}-{fecha}.{ext}
 */
export function buildReportFilename(
  materia: string,
  division: string,
  fecha: Date | string,
  extension: 'csv' | 'pdf',
): string {
  const cleanMateria = sanitizeFilenamePart(materia) || 'materia';
  const cleanDivision = sanitizeFilenamePart(division) || 'div';

  let dateStr = '';
  if (fecha instanceof Date) {
    dateStr = fecha.toISOString().split('T')[0];
  } else if (typeof fecha === 'string' && fecha.length >= 10) {
    dateStr = fecha.substring(0, 10);
  } else {
    dateStr = new Date().toISOString().split('T')[0];
  }

  return `notas-${cleanMateria}-${cleanDivision}-${dateStr}.${extension}`;
}

export interface ExamenReportRow {
  legajo: string;
  nombre: string;
  apellido: string;
  notaFinal: number | 'Sin publicar';
  nivelConfianza: string;
  fechaAprobacion: string;
}

export interface ExamenReportData {
  examen: {
    id: string;
    titulo: string;
    fecha: Date;
    curso: {
      id: string;
      materia: string;
      division: string;
      anio: number;
      anioLectivo: number;
    };
  };
  filas: ExamenReportRow[];
}

export interface CursoReportRow {
  legajo: string;
  nombre: string;
  apellido: string;
  notasPorExamen: Record<string, number | 'Sin publicar'>;
  promedio: number | 'Sin datos';
}

export interface CursoReportData {
  curso: {
    id: string;
    materia: string;
    division: string;
    anio: number;
    anioLectivo: number;
  };
  examenes: Array<{
    id: string;
    titulo: string;
    fecha: Date;
  }>;
  filas: CursoReportRow[];
}

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene la información estructurada de calificaciones de un examen específico.
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
          orderBy: [
            { alumno: { apellido: 'asc' } },
            { alumno: { nombre: 'asc' } },
          ],
        },
      },
    });

    if (!examen) {
      throw new NotFoundException(`Examen con ID ${examenId} no encontrado.`);
    }

    const filas: ExamenReportRow[] = examen.entregas.map((entrega) => {
      const estaPublicado =
        entrega.estado === 'PUBLICADO' && entrega.correccion?.notaFinal != null;

      const notaFinal = estaPublicado
        ? (entrega.correccion!.notaFinal as number)
        : 'Sin publicar';

      const nivelConfianza = entrega.correccion?.nivelConfianza || 'Sin datos';

      let fechaAprobacion = 'Sin publicar';
      if (estaPublicado && entrega.correccion?.fechaAprobacion) {
        fechaAprobacion = new Date(entrega.correccion.fechaAprobacion)
          .toISOString()
          .split('T')[0];
      }

      return {
        legajo: entrega.alumno.legajo,
        nombre: entrega.alumno.nombre,
        apellido: entrega.alumno.apellido,
        notaFinal,
        nivelConfianza,
        fechaAprobacion,
      };
    });

    return {
      examen: {
        id: examen.id,
        titulo: examen.titulo,
        fecha: examen.fecha,
        curso: {
          id: examen.curso.id,
          materia: examen.curso.materia,
          division: examen.curso.division,
          anio: examen.curso.anio,
          anioLectivo: examen.curso.anioLectivo,
        },
      },
      filas,
    };
  }

  /**
   * Obtiene la información consolidada de calificaciones de todos los alumnos y exámenes de un curso.
   */
  async getCursoReportData(cursoId: string): Promise<CursoReportData> {
    const curso = await this.prisma.curso.findUnique({
      where: { id: cursoId },
      include: {
        examenes: {
          include: {
            entregas: {
              include: {
                correccion: true,
              },
            },
          },
          orderBy: { fecha: 'asc' },
        },
        alumnos: {
          include: {
            alumno: true,
          },
          orderBy: [
            { alumno: { apellido: 'asc' } },
            { alumno: { nombre: 'asc' } },
          ],
        },
      },
    });

    if (!curso) {
      throw new NotFoundException(`Curso con ID ${cursoId} no encontrado.`);
    }

    const examenesInfo = curso.examenes.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      fecha: e.fecha,
    }));

    const filas: CursoReportRow[] = curso.alumnos.map((relacion) => {
      const alumno = relacion.alumno;
      const notasPorExamen: Record<string, number | 'Sin publicar'> = {};
      const notasPublicadas: number[] = [];

      for (const examen of curso.examenes) {
        const entrega = examen.entregas.find(
          (ent) => ent.alumnoId === alumno.id,
        );

        if (
          entrega &&
          entrega.estado === 'PUBLICADO' &&
          entrega.correccion?.notaFinal != null
        ) {
          const nota = entrega.correccion.notaFinal;
          notasPorExamen[examen.id] = nota;
          notasPublicadas.push(nota);
        } else {
          notasPorExamen[examen.id] = 'Sin publicar';
        }
      }

      let promedio: number | 'Sin datos' = 'Sin datos';
      if (notasPublicadas.length > 0) {
        const suma = notasPublicadas.reduce((acc, curr) => acc + curr, 0);
        const rawAvg = suma / notasPublicadas.length;
        promedio = Number.isInteger(rawAvg)
          ? rawAvg
          : Number(rawAvg.toFixed(2));
      }

      return {
        legajo: alumno.legajo,
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        notasPorExamen,
        promedio,
      };
    });

    return {
      curso: {
        id: curso.id,
        materia: curso.materia,
        division: curso.division,
        anio: curso.anio,
        anioLectivo: curso.anioLectivo,
      },
      examenes: examenesInfo,
      filas,
    };
  }

  /**
   * Genera el contenido del CSV para un examen con BOM UTF-8 y la directiva sep=,
   */
  async generateExamenCsv(
    examenId: string,
  ): Promise<{ filename: string; content: string }> {
    const data = await this.getExamenReportData(examenId);
    const filename = buildReportFilename(
      data.examen.curso.materia,
      data.examen.curso.division,
      data.examen.fecha,
      'csv',
    );

    const headers = [
      'Legajo',
      'Nombre',
      'Apellido',
      'Nota Final',
      'Nivel Confianza',
      'Fecha Aprobacion',
    ];

    const records = data.filas.map((fila) => [
      fila.legajo,
      normalizeForCsv(fila.nombre),
      normalizeForCsv(fila.apellido),
      fila.notaFinal,
      fila.nivelConfianza,
      fila.fechaAprobacion,
    ]);

    const csvData = stringify([headers, ...records]);
    // 1. BOM (\uFEFF)
    // 2. Línea sep=,\n
    // 3. Encabezados y datos
    const content = `\uFEFFsep=,\n${csvData}`;

    return { filename, content };
  }

  /**
   * Genera el contenido del CSV para un curso con BOM UTF-8 y la directiva sep=,
   */
  async generateCursoCsv(
    cursoId: string,
  ): Promise<{ filename: string; content: string }> {
    const data = await this.getCursoReportData(cursoId);
    const filename = buildReportFilename(
      data.curso.materia,
      data.curso.division,
      new Date(),
      'csv',
    );

    const headers = [
      'Legajo',
      'Nombre',
      'Apellido',
      ...data.examenes.map((e) => normalizeForCsv(e.titulo)),
      'Promedio',
    ];

    const records = data.filas.map((fila) => [
      fila.legajo,
      normalizeForCsv(fila.nombre),
      normalizeForCsv(fila.apellido),
      ...data.examenes.map((e) => fila.notasPorExamen[e.id]),
      fila.promedio,
    ]);

    const csvData = stringify([headers, ...records]);
    const content = `\uFEFFsep=,\n${csvData}`;

    return { filename, content };
  }

  /**
   * Genera un PDF tabular y formateado para las calificaciones de un examen.
   */
  async generateExamenPdf(
    examenId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getExamenReportData(examenId);
    const filename = buildReportFilename(
      data.examen.curso.materia,
      data.examen.curso.division,
      data.examen.fecha,
      'pdf',
    );

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc
        .fontSize(18)
        .fillColor('#1E293B')
        .text('EvalIA - Reporte de Calificaciones', { align: 'left' })
        .moveDown(0.3);

      doc
        .fontSize(14)
        .fillColor('#334155')
        .text(`Examen: ${data.examen.titulo}`)
        .fontSize(10)
        .fillColor('#64748B')
        .text(
          `Materia: ${data.examen.curso.materia} (${data.examen.curso.anio}° "${data.examen.curso.division}" - Ciclo ${data.examen.curso.anioLectivo})`,
        )
        .text(
          `Fecha de Examen: ${new Date(data.examen.fecha).toISOString().split('T')[0]} | Generado el: ${new Date().toISOString().split('T')[0]}`,
        )
        .moveDown(1);

      // Tabla
      const headers = [
        'Legajo',
        'Nombre y Apellido',
        'Nota Final',
        'Confianza IA',
        'Fecha Aprob.',
      ];
      const columnWidths = [135, 155, 80, 80, 65]; // total = 515 — legajo ancho para no cortar
      const startX = 40;
      let currentY = doc.y;

      // Dibujar cabecera de la tabla
      const drawHeader = (y: number) => {
        doc.rect(startX, y, 515, 20).fill('#2563EB');
        doc.fillColor('#FFFFFF').fontSize(9);

        let xOffset = startX + 5;
        headers.forEach((header, index) => {
          doc.text(header, xOffset, y + 5, {
            width: columnWidths[index],
            align: 'left',
          });
          xOffset += columnWidths[index];
        });
        return y + 22;
      };

      currentY = drawHeader(currentY);

      if (data.filas.length === 0) {
        doc
          .moveDown(1)
          .fillColor('#64748B')
          .fontSize(10)
          .text(
            'No hay entregas registradas para este examen.',
            startX,
            currentY + 10,
          );
      } else {
        data.filas.forEach((fila, index) => {
          // Salto de página si nos acercamos al margen inferior
          if (currentY > doc.page.height - 60) {
            doc.addPage();
            currentY = drawHeader(40);
          }

          const isEven = index % 2 === 0;
          if (isEven) {
            doc.rect(startX, currentY, 515, 18).fill('#F8FAFC');
          }

          doc.fillColor('#1E293B').fontSize(9);
          let xOffset = startX + 5;

          const rowValues = [
            fila.legajo,
            `${fila.apellido}, ${fila.nombre}`,
            typeof fila.notaFinal === 'number'
              ? fila.notaFinal.toString()
              : fila.notaFinal,
            fila.nivelConfianza,
            fila.fechaAprobacion,
          ];

          rowValues.forEach((val, colIdx) => {
            doc.text(val, xOffset, currentY + 4, {
              width: columnWidths[colIdx],
              align: 'left',
            });
            xOffset += columnWidths[colIdx];
          });

          currentY += 19;
        });
      }

      doc.end();
    });

    return { filename, buffer };
  }

  /**
   * Genera un PDF tabular y formateado para las calificaciones consolidadas de un curso.
   */
  async generateCursoPdf(
    cursoId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const data = await this.getCursoReportData(cursoId);
    const filename = buildReportFilename(
      data.curso.materia,
      data.curso.division,
      new Date(),
      'pdf',
    );

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      // Usar Landscape (apaisado) para permitir más columnas de exámenes
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Encabezado
      doc
        .fontSize(18)
        .fillColor('#1E293B')
        .text('EvalIA - Planilla Consolidada de Calificaciones', {
          align: 'left',
        })
        .moveDown(0.3);

      doc
        .fontSize(12)
        .fillColor('#334155')
        .text(
          `Materia: ${data.curso.materia} (${data.curso.anio}° "${data.curso.division}" - Ciclo ${data.curso.anioLectivo})`,
        )
        .fontSize(9)
        .fillColor('#64748B')
        .text(`Fecha de Emisión: ${new Date().toISOString().split('T')[0]}`)
        .moveDown(1);

      // Configuración de columnas
      const totalWidth = 760;
      const startX = 40;
      const legajoWidth = 140;
      const nombreWidth = 140;
      const promedioWidth = 70;
      const remainingWidth =
        totalWidth - legajoWidth - nombreWidth - promedioWidth;
      const examCount = data.examenes.length;
      const examColWidth =
        examCount > 0 ? Math.max(50, remainingWidth / examCount) : 0;

      const headers = [
        'Legajo',
        'Alumno',
        ...data.examenes.map((e) =>
          e.titulo.length > 15 ? e.titulo.substring(0, 13) + '...' : e.titulo,
        ),
        'Promedio',
      ];

      const columnWidths = [
        legajoWidth,
        nombreWidth,
        ...data.examenes.map(() => examColWidth),
        promedioWidth,
      ];

      let currentY = doc.y;

      const drawHeader = (y: number) => {
        doc.rect(startX, y, totalWidth, 20).fill('#2563EB');
        doc.fillColor('#FFFFFF').fontSize(8.5);

        let xOffset = startX + 5;
        headers.forEach((header, index) => {
          doc.text(header, xOffset, y + 5, {
            width: columnWidths[index],
            align: 'left',
          });
          xOffset += columnWidths[index];
        });
        return y + 22;
      };

      currentY = drawHeader(currentY);

      if (data.filas.length === 0) {
        doc
          .moveDown(1)
          .fillColor('#64748B')
          .fontSize(10)
          .text(
            'No hay alumnos registrados en este curso.',
            startX,
            currentY + 10,
          );
      } else {
        data.filas.forEach((fila, index) => {
          if (currentY > doc.page.height - 50) {
            doc.addPage();
            currentY = drawHeader(40);
          }

          const isEven = index % 2 === 0;
          if (isEven) {
            doc.rect(startX, currentY, totalWidth, 18).fill('#F8FAFC');
          }

          doc.fillColor('#1E293B').fontSize(8.5);
          let xOffset = startX + 5;

          const rowValues = [
            fila.legajo,
            `${fila.apellido}, ${fila.nombre}`,
            ...data.examenes.map((e) => {
              const val = fila.notasPorExamen[e.id];
              return typeof val === 'number' ? val.toString() : val;
            }),
            typeof fila.promedio === 'number'
              ? fila.promedio.toString()
              : fila.promedio,
          ];

          rowValues.forEach((val, colIdx) => {
            doc.text(val, xOffset, currentY + 4, {
              width: columnWidths[colIdx],
              align: 'left',
            });
            xOffset += columnWidths[colIdx];
          });

          currentY += 19;
        });
      }

      doc.end();
    });

    return { filename, buffer };
  }
}
