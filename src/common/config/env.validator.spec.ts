import { validateEnvConfig } from './env.validator';

describe('validateEnvConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('debe omitir validaciones y retornar válido cuando NODE_ENV es test', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;

    const result = validateEnvConfig();
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('debe emitir advertencias en modo desarrollo si faltan claves opcionales o se usan defaults', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GEMINI_API_KEY;

    const result = validateEnvConfig();
    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('debe lanzar error en producción si falta JWT_SECRET o se usa la clave por defecto', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'super-secret-key-evalia';

    expect(() => validateEnvConfig()).toThrow('Fallo al iniciar');
  });

  it('debe ser válido en producción cuando se proporcionan claves seguras', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'strong-production-jwt-secret-xyz123';
    process.env.DATABASE_URL = 'file:./prod.db';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const result = validateEnvConfig();
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
