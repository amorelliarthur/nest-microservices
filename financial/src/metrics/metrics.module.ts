import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { collectDefaultMetrics } from 'prom-client';

@Module({
  controllers: [MetricsController],
})
export class MetricsModule {
  constructor() {
    // coleta métricas padrão do Node.js (CPU, memória, event loop)
    collectDefaultMetrics();
  }
}
