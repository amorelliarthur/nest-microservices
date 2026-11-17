import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

type LoggableData = Record<string, unknown> | undefined;

// Allowlist: só estes headers aparecem no log. Todo o resto (segredo do
// gateway, token interno, JWT do cliente e qualquer header novo) vira [REDACTED].
const LOGGABLE_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'connection',
  'content-length',
  'content-type',
  'host',
  'user-agent',
]);

const REDACTED = '[REDACTED]';

const redactHeaders = (headers: LoggableData): Record<string, unknown> => {
  if (!headers || typeof headers !== 'object') return {};

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      LOGGABLE_HEADERS.has(name.toLowerCase()) ? value : REDACTED,
    ]),
  );
};

// Um campo é sensível quando o nome CONTÉM um destes termos (sem diferenciar
// maiúsculas): assim `novaSenha` e `refreshToken` já nascem protegidos.
const SENSITIVE_TERMS = [
  'senha',
  'password',
  'token',
  'authorization',
  'cookie',
  'cpf',
];

const MASK = '******';

const isSensitiveKey = (key: string): boolean => {
  const name = key.toLowerCase();
  return SENSITIVE_TERMS.some((term) => name.includes(term));
};

// Percorre objetos e arrays em qualquer profundidade
const maskBody = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(maskBody);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      isSensitiveKey(key) ? MASK : maskBody(nested),
    ]),
  );
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly isDev = process.env.NODE_ENV === 'dev';

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;
    const url = request.url;
    const headers = request.headers;
    const body = request.body as LoggableData;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = response.statusCode;

        if (this.isDev) {
          // Dev: log detalhado no console
          this.logger.log(
            `${method} ${url} ${status} - ${duration}ms\n` +
              `Headers: ${JSON.stringify(redactHeaders(headers), null, 2)}\n` +
              `Body: ${JSON.stringify(this.maskSensitive(body), null, 2)}`,
          );
        } else {
          // Prod: só a linha resumida no stdout; a coleta fica com a infraestrutura
          this.logger.log(`${method} ${url} ${status} - ${duration}ms`);
        }
      }),
    );
  }

  // Mascara campos sensíveis do body
  private maskSensitive(data: LoggableData): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {};

    return maskBody(data) as Record<string, unknown>;
  }
}
