import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly isDev = process.env.NODE_ENV === 'dev';

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, headers, body } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const status = response.statusCode;

        if (this.isDev) {
          // Dev: log detalhado no console
          this.logger.log(
            `${method} ${url} ${status} - ${duration}ms\n` +
              `Headers: ${JSON.stringify(this.maskSensitive(headers), null, 2)}\n` +
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

  // Mascara campos sensíveis
  private maskSensitive(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitive = ['senha', 'token', 'authorization', 'cookie', 'cpf'];
    const masked = { ...data };

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
    headers: any,
    body: any,
  ) {
    const logPath = path.join(process.cwd(), 'app.log');
    const entry =
      `${new Date().toISOString()} ${method} ${url} ${status} - ${duration}ms\n` +
      `Headers: ${JSON.stringify(this.maskSensitive(headers), null, 2)}\n` +
      `Body: ${JSON.stringify(this.maskSensitive(body), null, 2)}\n` +
      `${'─'.repeat(60)}\n`;

    fs.appendFileSync(logPath, entry);
  }
}
