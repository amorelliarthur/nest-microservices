import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita validação global via class-validator em todos os endpoints
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const port = process.env.PORTA || 3000;
  await app.listen(port);
  console.log(`User service rodando na porta ${port}`);
}
bootstrap();