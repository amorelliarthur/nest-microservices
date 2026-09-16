import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Histogram } from 'prom-client';
import type { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject('HTTP_REQUEST_DURATION')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const end = this.histogram.startTimer();

    // 'finish' dispara quando a resposta é enviada, com o status FINAL
    // (já processado pelo exception filter do Nest)
    res.on('finish', () => {
      // req.route é tipado como `any` no Express; tratamos com segurança
      const route =
        (req.route as { path?: string } | undefined)?.path ?? req.url;
      end({
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    });

    return next.handle();
  }
}
