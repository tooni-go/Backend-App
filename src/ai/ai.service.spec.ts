import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import {
  AiService,
  RegenerarPreguntaInput,
  RegeneracionSugerenciaSchema,
} from './ai.service';

describe('AiService - regenerarPregunta', () => {
  let service: AiService;

  const mockPregunta: RegenerarPreguntaInput = {
    enunciado: '¿Cuál es la ley de Ohm y cuál es su fórmula?',
    respuestaEsperada: 'V = I * R. Relaciona voltaje, corriente y resistencia.',
    puntajeMaximo: 10,
    criteriosIA: 'Verificar la definición conceptual y las unidades de medida.',
    esEvaluacionVisual: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Schema Zod - RegeneracionSugerenciaSchema', () => {
    it('debe validar exitosamente un objeto con estructura correcta', () => {
      const valid = {
        enunciado: 'Explique la relación entre voltaje y corriente.',
        respuestaEsperada: 'V = I * R con unidades.',
        esEvaluacionVisual: false,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('debe rechazar si falta esEvaluacionVisual o es null', () => {
      const invalid = {
        enunciado: 'Pregunta de prueba',
        respuestaEsperada: 'Respuesta de prueba',
        esEvaluacionVisual: null,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('debe rechazar si enunciado o respuestaEsperada están vacíos', () => {
      const invalid = {
        enunciado: '',
        respuestaEsperada: 'Respuesta',
        esEvaluacionVisual: false,
      };

      const result = RegeneracionSugerenciaSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('regenerarPregunta con Gemini y fallback a OpenRouter', () => {
    it('debe regenerar exitosamente con Gemini como proveedor principal', async () => {
      const mockGeminiResponse = JSON.stringify({
        enunciado:
          'Defina la ley de Ohm indicando la relación entre potencial, corriente y resistencia.',
        respuestaEsperada: 'V = I * R',
        esEvaluacionVisual: false,
      });

      const invokeGeminiSpy = jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(mockGeminiResponse);

      const invokeOpenRouterSpy = jest.spyOn(
        service as any,
        'invokeOpenRouter',
      );

      const result = await service.regenerarPregunta(mockPregunta, 'REFRASEO');

      expect(invokeGeminiSpy).toHaveBeenCalledTimes(1);
      expect(invokeOpenRouterSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        enunciado:
          'Defina la ley de Ohm indicando la relación entre potencial, corriente y resistencia.',
        respuestaEsperada: 'V = I * R',
        esEvaluacionVisual: false,
      });
    });

    it('debe usar fallback a OpenRouter cuando Gemini falla', async () => {
      const mockOpenRouterResponse = JSON.stringify({
        enunciado:
          '¿Cuál de las siguientes fórmulas representa la ley de Ohm?\nA) V = I/R\nB) V = I * R\nC) I = V * R\nD) R = V * I',
        respuestaEsperada: 'Opción B (V = I * R)',
        esEvaluacionVisual: false,
      });

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockRejectedValue(new Error('Gemini API quota exceeded or timeout'));

      const invokeOpenRouterSpy = jest
        .spyOn(service as any, 'invokeOpenRouter')
        .mockResolvedValue(mockOpenRouterResponse);

      const result = await service.regenerarPregunta(
        mockPregunta,
        'CAMBIO_FORMATO',
        { formatoDestino: 'MULTIPLE_CHOICE' },
      );

      expect(invokeOpenRouterSpy).toHaveBeenCalledTimes(1);
      expect(result.enunciado).toContain('¿Cuál de las siguientes fórmulas');
      expect(result.respuestaEsperada).toBe('Opción B (V = I * R)');
      expect(result.esEvaluacionVisual).toBe(false);
    });

    it('debe lanzar InternalServerErrorException si la respuesta de la IA no cumple con el schema Zod', async () => {
      const mockMalformedResponse = JSON.stringify({
        enunciado: 'Solo enunciado sin respuesta ni esEvaluacionVisual',
      });

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(mockMalformedResponse);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(
        'La sugerencia generada por la IA no cumple con el formato estructurado requerido.',
      );
    });

    it('debe lanzar InternalServerErrorException si ambos proveedores (Gemini y OpenRouter) fallan', async () => {
      jest
        .spyOn(service as any, 'invokeGemini')
        .mockRejectedValue(new Error('Gemini error'));
      jest
        .spyOn(service as any, 'invokeOpenRouter')
        .mockRejectedValue(new Error('OpenRouter error'));

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(InternalServerErrorException);

      await expect(
        service.regenerarPregunta(mockPregunta, 'REFRASEO'),
      ).rejects.toThrow(
        'No fue posible regenerar la pregunta con los servicios de IA disponibles.',
      );
    });

    it('debe limpiar bloques markdown en la respuesta antes de validar con Zod', async () => {
      const markdownJson = `\`\`\`json
{
  "enunciado": "Refraseo con markdown envolvente",
  "respuestaEsperada": "Respuesta correcta",
  "esEvaluacionVisual": false
}
\`\`\``;

      jest
        .spyOn(service as any, 'invokeGemini')
        .mockResolvedValue(markdownJson);

      const result = await service.regenerarPregunta(mockPregunta, 'REFRASEO');

      expect(result.enunciado).toBe('Refraseo con markdown envolvente');
    });
  });
});
