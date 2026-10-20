import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = app.get(ConfigService).get<number>('PORT', 3006);
  await app.listen(port);
  new Logger('Bootstrap').log(`ai-service running on port ${port}`);
}
void bootstrap();
