import { NestFactory } from '@nestjs/core';
import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // debug e verbose só em desenvolvimento
  const logLevels: LogLevel[] =
    process.env.NODE_ENV === 'dev'
      ? ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']
      : ['fatal', 'error', 'warn', 'log'];
  const app = await NestFactory.create(AppModule, { logger: logLevels });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORTA || 3001;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `${process.env.APP_NAME} running on port ${port}`,
  );
}
void bootstrap();
