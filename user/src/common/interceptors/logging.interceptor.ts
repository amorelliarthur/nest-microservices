import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

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
          // Prod: simplificado no console
          this.logger.log(`${method} ${url} ${status} - ${duration}ms`);

          // Prod: detalhado em arquivo
          this.writeToFile(method, url, status, duration, headers, body);
        }
      }),
    );
  }

  // Mascara campos sensíveis do body
  private maskSensitive(data: LoggableData): Record<string, unknown> {
    if (!data || typeof data !== 'object') return {};

    const sensitive = ['senha', 'token', 'authorization', 'cookie', 'cpf'];
    const masked: Record<string, unknown> = { ...data };

    for (const key of Object.keys(masked)) {
      if (sensitive.includes(key.toLowerCase())) {
        masked[key] = '******';
      }
    }
    return masked;
  }

  private writeToFile(
    method: string,
    url: string,
    status: number,
    duration: number,
    headers: LoggableData,
    body: LoggableData,
  ) {
    const logPath = path.join(process.cwd(), 'app.log');
    const entry =
      `${new Date().toISOString()} ${method} ${url} ${status} - ${duration}ms\n` +
      `Headers: ${JSON.stringify(redactHeaders(headers), null, 2)}\n` +
      `Body: ${JSON.stringify(this.maskSensitive(body), null, 2)}\n` +
      `${'─'.repeat(60)}\n`;

    fs.appendFileSync(logPath, entry);
  }
}
