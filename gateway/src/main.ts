import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthMiddleware } from './common/middlewares/auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // ← desabilita para o proxy funcionar corretamente
  });

  // garante rate limit e auth em todas as rotas
  const authMiddleware = app.get(AuthMiddleware);
  app.use((req, res, next) => authMiddleware.use(req, res, next));

  // Rota de health check
  app.getHttpAdapter().get('/test', (req, res) => {
    res.json({ status: 'gateway ok' });
  });

  const port = process.env.PORTA || 3002;
  await app.listen(port);
  console.log(`[${process.env.APP_NAME}] running on port ${port}`);
}
bootstrap();
