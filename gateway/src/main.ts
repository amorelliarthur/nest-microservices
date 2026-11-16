import { Logger, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AuthMiddleware } from './common/middlewares/auth.middleware';

async function bootstrap() {
  // debug e verbose só em desenvolvimento
  const logLevels: LogLevel[] =
    process.env.NODE_ENV === 'dev'
      ? ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']
      : ['fatal', 'error', 'warn', 'log'];
  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
    bodyParser: false, // desabilita para o proxy funcionar corretamente
  });

  // garante rate limit e auth em todas as rotas — exceto /metrics
  const authMiddleware = app.get(AuthMiddleware);
  app.use((req: Request, res: Response, next: NextFunction) => {
    // /metrics é endpoint de observabilidade: sem auth e sem rate limit
    if (req.url === '/metrics') return next();
    return authMiddleware.use(req, res, next);
  });

  // Rota de health check
  app.getHttpAdapter().get('/test', (req: Request, res: Response) => {
    res.json({ status: 'gateway ok' });
  });

  const port = process.env.PORTA || 3002;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `${process.env.APP_NAME} running on port ${port}`,
  );
}
void bootstrap();
