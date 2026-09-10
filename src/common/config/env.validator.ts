import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidator');

export interface EnvValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Valida la configuración de variables de entorno al iniciar la aplicación.
 * En modo producción, falla si faltan variables críticas de seguridad.
 * En modo desarrollo, emite advertencias claras para guiar al desarrollador.
 */
export function validateEnvConfig(): EnvValidationResult {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const warnings: string[] = [];
  const errors: string[] = [];

  // En entorno de testing no emitimos advertencias ni bloqueamos la ejecución
  if (isTest) {
    return { isValid: true, warnings: [], errors: [] };
  }

  // 1. Validación de Autenticación / JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProd) {
      errors.push('JWT_SECRET no está definida. Es obligatoria en producción.');
    } else {
      warnings.push(
        'JWT_SECRET no está definida. Se utilizará el valor por defecto de desarrollo ("super-secret-key-evalia").',
      );
    }
  } else if (jwtSecret === 'super-secret-key-evalia' && isProd) {
    errors.push(
      'JWT_SECRET utiliza la clave por defecto insegura ("super-secret-key-evalia") en producción. Debe configurarse un secreto fuerte.',
    );
  }

  // 2. Validación de Google OAuth
  if (!process.env.GOOGLE_CLIENT_ID) {
    warnings.push(
      'GOOGLE_CLIENT_ID no está definida. La autenticación con Google OAuth fallará en runtime si no se provee.',
    );
  }

  // 3. Validación de Motores de IA
  if (!process.env.GEMINI_API_KEY) {
    warnings.push(
      'GEMINI_API_KEY no está configurada. Las funciones de IA (generación de exámenes y corrección) fallarán.',
    );
  }

  // 4. Base de Datos
  if (!process.env.DATABASE_URL) {
    warnings.push(
      'DATABASE_URL no está definida. Se utilizará SQLite por defecto ("file:./dev.db").',
    );
  }

  // Reportar advertencias
  if (warnings.length > 0) {
    logger.warn('⚠️ Advertencias de configuración de entorno:');
    warnings.forEach((w) => logger.warn(`  - ${w}`));
  }

  // Si hay errores críticos en producción, abortar el arranque
  if (errors.length > 0) {
    logger.error('❌ Error crítico de configuración de entorno:');
    errors.forEach((e) => logger.error(`  - ${e}`));
    if (isProd) {
      throw new Error(
        `Fallo al iniciar por variables de entorno inválidas: \n${errors.join('\n')}`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
