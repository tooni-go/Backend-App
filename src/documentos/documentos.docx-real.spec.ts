import { DocumentosService } from './documentos.service';
import { AiService } from '../ai/ai.service';
import { createMinimalDocxBuffer } from './test-helpers/create-minimal-docx';

describe('DocumentosService DOCX real (mammoth, sin mock)', () => {
  const extractTextFromDocument = jest.fn();
  const service = new DocumentosService({
    extractTextFromDocument,
  } as unknown as AiService);

  it('extracts verbatim text from a real OOXML .docx', async () => {
    const expectedLines =
      'Examen de Historia\nPregunta 1: Explique las causas de la Revolucion de Mayo.';
    const buffer = createMinimalDocxBuffer(expectedLines);

    const result = await service.extractText({
      mimetype:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer,
      size: buffer.length,
      originalname: 'examen-historia.docx',
    } as Express.Multer.File);

    expect(result.fuenteTipo).toBe('docx');
    expect(result.requiereRevision).toBe(false);
    expect(result.textoExtraido).toContain('Examen de Historia');
    expect(result.textoExtraido).toContain('Revolucion de Mayo');
    expect(extractTextFromDocument).not.toHaveBeenCalled();
  });
});
