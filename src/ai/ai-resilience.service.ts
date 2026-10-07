import { Injectable, Logger } from '@nestjs/common';

export type AiErrorType =
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'QUOTA_EXCEEDED'
  | 'AUTHENTICATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

export interface ClassifiedAiError {
  tipo: AiErrorType;
  mensaje: string;
  statusCode?: number;
  originalError: unknown;
}

export interface FallbackEventDetails {
  flujo: string;
  proveedorFallido: 'gemini' | 'openrouter';
  error: unknown;
  tipoError?: string;
  tipoFallo?: AiErrorType;
  causa?: string;
  proveedorActivado: 'openrouter' | 'ninguno';
  modeloOpenRouter?: string;
}

export interface AiMetricsDetails {
  llamadasExitosas: number;
  llamadasFallidas: number;
}

export interface AiMetricsResponse {
  gemini: AiMetricsDetails;
  openRouter: AiMetricsDetails;
  ultimaActualizacion: string;
}

export interface RetryOptions {
  maxRetries?: number;
  delaysMs?: number[];
  operationLabel?: string;
  context?: string;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface CallWithFallbackOptions<T> {
  context: string;
  geminiCall: () => Promise<T>;
  openRouterCall: () => Promise<T>;
  timeoutMs?: number;
  openRouterModel?: string;
  retryOptions?: Partial<RetryOptions>;
}

export const DEFAULT_AI_TIMEOUT_MS = 35000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_RETRY_DELAYS_MS = [1500, 3000];

@Injectable()
export class AiResilienceService {
  private readonly logger = new Logger(AiResilienceService.name);

  private geminiSuccesses = 0;
  private geminiFailures = 0;
  private openRouterSuccesses = 0;
  private openRouterFailures = 0;
  private lastUpdated: Date = new Date();

  /**
   * Obtiene el timeout configurado en milisegundos (por defecto 35 segundos, en rango seguro 30s–45s).
   */
  getTimeoutMs(): number {
    const envVal = process.env.AI_TIMEOUT_MS;
    if (envVal) {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return DEFAULT_AI_TIMEOUT_MS;
  }

  /**
   * Determina si un error capturado es de naturaleza transitoria (429, 503, errores de red/sobrecarga)
   * y por ende es candidato válido para aplicar política de reintentos con exponential backoff.
   */
  isTransientError(error: unknown): boolean {
    if (!error) {
      return false;
    }

    const classified = this.classifyAiError(error);

    // Errores definitivamente no transitorios: no se deben reintentar
    if (
      classified.tipo === 'AUTHENTICATION_ERROR' ||
      classified.tipo === 'VALIDATION_ERROR' ||
      classified.tipo === 'BAD_REQUEST'
    ) {
      return false;
    }

    if (
      classified.tipo === 'RATE_LIMIT' ||
      classified.tipo === 'QUOTA_EXCEEDED'
    ) {
      return true;
    }

    if (classified.statusCode === 429 || classified.statusCode === 503) {
      return true;
    }

    const status =
      (error as any)?.status ||
      (error as any)?.statusCode ||
      (error as any)?.response?.status;

    if (status === 429 || status === 503 || status === 502 || status === 504) {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (
      /\b(429|503|502|504)\b/.test(message) ||
      /rate limit/i.test(message) ||
      /too many requests/i.test(message) ||
      /service unavailable/i.test(message) ||
      /overloaded/i.test(message) ||
      /high demand/i.test(message) ||
      /temporarily unavailable/i.test(message) ||
      /quota/i.test(message) ||
      /resource_exhausted/i.test(message) ||
      /ECONNRESET/i.test(message) ||
      /ETIMEDOUT/i.test(message) ||
      /ENOTFOUND/i.test(message) ||
      /network error/i.test(message) ||
      /fetch failed/i.test(message) ||
      /socket hang up/i.test(message)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Helper para pausas asíncronas (espera de backoff).
   * Permite ser espiado o sobreescrito en pruebas unitarias.
   */
  async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Ejecuta una operación asíncrona aplicando política de reintentos con exponential backoff
   * únicamente ante fallos transitorios (429, 503, red).
   * Parámetros por defecto: 2 reintentos (3 intentos totales) con esperas de 1.5s (1500ms) y 3.0s (3000ms).
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: RetryOptions,
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const delaysMs = options?.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    const operationLabel = options?.operationLabel ?? 'Operación IA';
    const context = options?.context ?? 'ai';
    const sleepFn = options?.sleepFn ?? ((ms: number) => this.sleep(ms));

    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error: unknown) {
        attempt++;
        const isTransient = this.isTransientError(error);

        if (!isTransient || attempt > maxRetries) {
          throw error;
        }

        const delayMs =
          delaysMs[attempt - 1] ??
          delaysMs[delaysMs.length - 1] ??
          1500 * Math.pow(2, attempt - 1);
        const classified = this.classifyAiError(error);

        this.logger.warn(
          `[${context}] Reintento ${attempt}/${maxRetries} para ${operationLabel} tras espera de ${delayMs}ms debido a error transitorio [${classified.tipo}]: ${classified.mensaje}`,
        );

        await sleepFn(delayMs);
      }
    }
  }

  /**
   * Clasifica explícitamente el tipo de error ocurrido en la llamada a un proveedor de IA.
   * Distingue entre RATE_LIMIT (429), SERVER_ERROR (5xx), TIMEOUT, QUOTA_EXCEEDED, VALIDATION_ERROR, etc.
   */
  classifyAiError(error: unknown): ClassifiedAiError {
    if (!error) {
      return {
        tipo: 'UNKNOWN',
        mensaje: 'Error desconocido',
        originalError: error,
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    const status =
      (error as any)?.status ||
      (error as any)?.statusCode ||
      (error as any)?.response?.status;

    // 1. Timeout
    if (
      /timeout/i.test(message) ||
      /timed out/i.test(message) ||
      (error as any)?.name === 'AbortError' ||
      (error as any)?.code === 'ETIMEDOUT'
    ) {
      return {
        tipo: 'TIMEOUT',
        mensaje: message,
        statusCode: 408,
        originalError: error,
      };
    }

    // 2. Cuota agotada (Resource Exhausted / Insufficient Quota)
    if (
      /quota/i.test(message) ||
      /resource_exhausted/i.test(message) ||
      /insufficient_quota/i.test(message) ||
      /credit balance/i.test(message) ||
      /cuota/i.test(message)
    ) {
      return {
        tipo: 'QUOTA_EXCEEDED',
        mensaje: message,
        statusCode: 429,
        originalError: error,
      };
    }

    // 3. Rate limit (429 Too Many Requests)
    if (
      status === 429 ||
      /\b429\b/.test(message) ||
      /rate limit/i.test(message) ||
      /too many requests/i.test(message)
    ) {
      return {
        tipo: 'RATE_LIMIT',
        mensaje: message,
        statusCode: 429,
        originalError: error,
      };
    }

    // 4. Server error (5xx)
    if (
      (typeof status === 'number' && status >= 500 && status < 600) ||
      /\b(500|502|503|504)\b/.test(message) ||
      /bad gateway/i.test(message) ||
      /service unavailable/i.test(message) ||
      /gateway timeout/i.test(message) ||
      /internal server error/i.test(message)
    ) {
      let resolvedStatus = typeof status === 'number' ? status : 500;
      if (typeof status !== 'number') {
        const match = message.match(/\b(500|502|503|504)\b/);
        if (match) {
          resolvedStatus = parseInt(match[1], 10);
        }
      }
      return {
        tipo: 'SERVER_ERROR',
        mensaje: message,
        statusCode: resolvedStatus,
        originalError: error,
      };
    }

    // 5. Authentication error (401, 403)
    if (
      status === 401 ||
      status === 403 ||
      /\b(401|403)\b/.test(message) ||
      /unauthorized/i.test(message) ||
      /forbidden/i.test(message) ||
      /api key/i.test(message) ||
      /permission_denied/i.test(message)
    ) {
      return {
        tipo: 'AUTHENTICATION_ERROR',
        mensaje: message,
        statusCode: typeof status === 'number' ? status : 401,
        originalError: error,
      };
    }

    // 6. Validation error (JSON Schema / Zod / Parse)
    if (
      /esquema/i.test(message) ||
      /zod/i.test(message) ||
      /invalid input/i.test(message) ||
      /JSON/i.test(message)
    ) {
      return {
        tipo: 'VALIDATION_ERROR',
        mensaje: message,
        statusCode: 422,
        originalError: error,
      };
    }

    // 7. Bad request (400)
    if (
      status === 400 ||
      /\b400\b/.test(message) ||
      /bad request/i.test(message) ||
      /invalid_argument/i.test(message)
    ) {
      return {
        tipo: 'BAD_REQUEST',
        mensaje: message,
        statusCode: 400,
        originalError: error,
      };
    }

    return {
      tipo: 'UNKNOWN',
      mensaje: message,
      statusCode: status,
      originalError: error,
    };
  }

  /**
   * Ejecuta una promesa con límite de tiempo configurado.
   */
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationLabel: string,
  ): Promise<T> {
    let timerId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        const seconds = Math.round(timeoutMs / 1000);
        reject(
          new Error(
            `Timeout de ${seconds} segundos en ${operationLabel} alcanzado`,
          ),
        );
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } finally {
      if (timerId) {
        clearTimeout(timerId);
      }
    }
  }

  /**
   * Emite un log estructurado con la información del evento de fallback y clasificación del fallo.
   */
  logFallbackEvent(params: FallbackEventDetails): void {
    const causa =
      params.causa ||
      (params.error instanceof Error
        ? params.error.message
        : String(params.error));

    const classified = this.classifyAiError(params.error);
    const tipoFallo = params.tipoFallo || classified.tipo;

    // Compatibilidad con el campo tipoError histórico ('timeout' | 'api_error' | 'unknown')
    let legacyTipoError: 'timeout' | 'api_error' | 'unknown' = 'unknown';
    if (tipoFallo === 'TIMEOUT') {
      legacyTipoError = 'timeout';
    } else if (
      tipoFallo === 'RATE_LIMIT' ||
      tipoFallo === 'SERVER_ERROR' ||
      tipoFallo === 'QUOTA_EXCEEDED' ||
      tipoFallo === 'AUTHENTICATION_ERROR'
    ) {
      legacyTipoError = 'api_error';
    }

    const payload: Record<string, unknown> = {
      flujo: params.flujo,
      proveedorFallido: params.proveedorFallido,
      causa,
      tipoError: params.tipoError || legacyTipoError,
      tipoFallo,
      proveedorActivado: params.proveedorActivado,
      ...(params.modeloOpenRouter
        ? { modeloOpenRouter: params.modeloOpenRouter }
        : {}),
    };

    this.logger.warn(`FALLBACK_EVENT ${JSON.stringify(payload)}`);
  }

  /**
   * Ejecuta una llamada hacia Gemini con reintentos exponenciales y fallback automático hacia OpenRouter.
   * Maneja reintentos ante errores 429/503/red (1.5s y 3.0s), clasificación de errores, timeouts unificados, logging estructurado y métricas.
   */
  async callWithFallback<T>(params: CallWithFallbackOptions<T>): Promise<T> {
    const { context, geminiCall, openRouterCall } = params;
    const timeoutMs = params.timeoutMs || this.getTimeoutMs();

    // 1. Intentar proveedor principal: Gemini API (con reintentos)
    try {
      this.logger.log(
        `[${context}] Iniciando llamada a Gemini API (proveedor principal)...`,
      );
      const result = await this.executeWithRetry(
        () =>
          this.executeWithTimeout(geminiCall, timeoutMs, 'Gemini API'),
        {
          context,
          operationLabel: 'Gemini API',
          ...params.retryOptions,
        },
      );
      this.geminiSuccesses++;
      this.lastUpdated = new Date();
      this.logger.log(
        `[${context}] Respuesta recibida exitosamente de Gemini.`,
      );
      return result;
    } catch (geminiError: unknown) {
      this.geminiFailures++;
      this.lastUpdated = new Date();

      const classified = this.classifyAiError(geminiError);
      this.logger.warn(
        `[${context}] Fallo en Gemini API [${classified.tipo}]: ${classified.mensaje}. Iniciando fallback a OpenRouter...`,
      );

      this.logFallbackEvent({
        flujo: context,
        proveedorFallido: 'gemini',
        error: geminiError,
        tipoFallo: classified.tipo,
        proveedorActivado: 'openrouter',
        modeloOpenRouter: params.openRouterModel,
      });

      // 2. Fallback a proveedor secundario: OpenRouter API (con reintentos)
      try {
        this.logger.log(`[${context}] Ejecutando fallback con OpenRouter...`);
        const openRouterResult = await this.executeWithRetry(
          () =>
            this.executeWithTimeout(
              openRouterCall,
              timeoutMs,
              'OpenRouter API',
            ),
          {
            context,
            operationLabel: 'OpenRouter API',
            ...params.retryOptions,
          },
        );
        this.openRouterSuccesses++;
        this.lastUpdated = new Date();
        this.logger.log(
          `[${context}] Respuesta recibida exitosamente de OpenRouter.`,
        );
        return openRouterResult;
      } catch (openRouterError: unknown) {
        this.openRouterFailures++;
        this.lastUpdated = new Date();

        const classifiedOpenRouter = this.classifyAiError(openRouterError);
        this.logger.error(
          `[${context}] Fallo también en OpenRouter API [${classifiedOpenRouter.tipo}]: ${classifiedOpenRouter.mensaje}. Ningún proveedor disponible.`,
        );

        this.logFallbackEvent({
          flujo: context,
          proveedorFallido: 'openrouter',
          error: openRouterError,
          tipoFallo: classifiedOpenRouter.tipo,
          proveedorActivado: 'ninguno',
        });

        throw openRouterError;
      }
    }
  }

  /**
   * Retorna las métricas acumuladas en memoria de llamadas a los proveedores.
   */
  getMetrics(): AiMetricsResponse {
    return {
      gemini: {
        llamadasExitosas: this.geminiSuccesses,
        llamadasFallidas: this.geminiFailures,
      },
      openRouter: {
        llamadasExitosas: this.openRouterSuccesses,
        llamadasFallidas: this.openRouterFailures,
      },
      ultimaActualizacion: this.lastUpdated.toISOString(),
    };
  }

  /**
   * Reinicia las métricas en memoria (útil para pruebas unitarias).
   */
  resetMetrics(): void {
    this.geminiSuccesses = 0;
    this.geminiFailures = 0;
    this.openRouterSuccesses = 0;
    this.openRouterFailures = 0;
    this.lastUpdated = new Date();
  }
}
