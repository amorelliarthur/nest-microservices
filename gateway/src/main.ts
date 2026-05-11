import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // ← desabilita para o proxy funcionar corretamente
  });

  // Rota de health check
  app.getHttpAdapter().get('/test', (req, res) => {
    res.json({ status: 'gateway ok' });
  });

  const port = process.env.PORTA || 3002;
  await app.listen(port);
  console.log(`[${process.env.APP_NAME}] running on port ${port}`);
}
bootstrap();