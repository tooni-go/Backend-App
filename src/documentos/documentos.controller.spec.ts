import { Test, TestingModule } from '@nestjs/testing';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';
import { ExtraerTextoResponseDto } from './dto/extraer-texto-response.dto';

describe('DocumentosController', () => {
  let controller: DocumentosController;
  let service: DocumentosService;

  const mockDocumentosService = {
    extractText: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentosController],
      providers: [
        {
          provide: DocumentosService,
          useValue: mockDocumentosService,
        },
      ],
    }).compile();

    controller = module.get<DocumentosController>(DocumentosController);
    service = module.get<DocumentosService>(DocumentosService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('extraerTexto', () => {
    it('should delegate extraction to DocumentosService', async () => {
      const mockResponse: ExtraerTextoResponseDto = {
        textoExtraido: 'Contenido extraído',
        fuenteTipo: 'txt',
        requiereRevision: false,
      };

      mockDocumentosService.extractText.mockResolvedValue(mockResponse);

      const file = {
        mimetype: 'text/plain',
        buffer: Buffer.from('Contenido extraído'),
      } as Express.Multer.File;

      const result = await controller.extraerTexto(file);

      expect(service.extractText).toHaveBeenCalledWith(file);
      expect(result).toBe(mockResponse);
    });
  });
});
