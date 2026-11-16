// src/main.ts
import { NestFactory } from '@nestjs/core';
import { Logger, LogLevel, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // debug e verbose só em desenvolvimento
  const logLevels: LogLevel[] =
    process.env.NODE_ENV === 'dev'
      ? ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']
      : ['fatal', 'error', 'warn', 'log'];
  const app = await NestFactory.create(AppModule, { logger: logLevels });

  // conecta ao RabbitMQ como consumidor
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
      queue: 'users_queue',
      queueOptions: { durable: true },
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());

  // inicia HTTP e microservice juntos
  await app.startAllMicroservices();

  const port = process.env.PORTA || 3004;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `${process.env.APP_NAME} running on port ${port}`,
  );
}
void bootstrap();
