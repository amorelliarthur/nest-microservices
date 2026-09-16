import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { collectDefaultMetrics, Histogram } from 'prom-client';

// histogram que mede a duração das requisições HTTP
// os "buckets" são faixas de tempo (em segundos) para calcular percentis
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5], // 50ms até 5s
});

@Module({
  controllers: [MetricsController],
  providers: [
    {
      provide: 'HTTP_REQUEST_DURATION',
      useValue: httpRequestDuration,
    },
  ],
  exports: ['HTTP_REQUEST_DURATION'],
})
export class MetricsModule {
  constructor() {
    collectDefaultMetrics();
  }
}
