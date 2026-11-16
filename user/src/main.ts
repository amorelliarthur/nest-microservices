import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // conecta ao RabbitMQ como consumidor
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
      queue: 'transactions_queue',
      queueOptions: { durable: true },
    },
  });

  // Habilita validação global via class-validator em todos os endpoints
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());

  // inicia HTTP e microservice juntos
  await app.startAllMicroservices();
  new Logger('Bootstrap').log('RabbitMQ consumer started');

  const port = process.env.PORTA || 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(
    `${process.env.APP_NAME} running on port ${port}`,
  );
}
void bootstrap();
