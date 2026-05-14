import * as dotenv from 'dotenv';
dotenv.config(); // carrega o .env antes de qualquer coisa

import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AuthMiddleware } from './common/middlewares/auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule,
  ],
  providers: [AuthMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const authServer = process.env.AUTH_SERVER;
    const userServer = process.env.USER_SERVER;
    const financialServer = process.env.FINANCIAL_SERVER;

    // Auth middleware aplicado em todas as rotas — ele mesmo decide o que é público
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*path', method: RequestMethod.ALL });

    const proxies: Array<{ path: string; target: string | undefined; rewrite: Record<string, string> }> = [
      { path: '/auth/*path', target: authServer, rewrite: { '^/auth': '/auth' } },
      { path: '/user/*path', target: userServer, rewrite: { '^/user': '/user' } },
      { path: '/financial/*path', target: financialServer, rewrite: { '^/financial': '' } },
    ];

    for (const { path, target, rewrite } of proxies) {
      if (!target) {
        console.warn(`[Gateway] Variável de ambiente ausente para rota ${path} — proxy ignorado`);
        continue;
      }

      const proxyInstance = createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: rewrite,
      });

      // Casa rotas com segmentos: /user/me, /user/:id
      consumer
        .apply(proxyInstance)
        .forRoutes({ path, method: RequestMethod.ALL });

      // Casa a rota raiz: /user, /auth
      consumer
        .apply(proxyInstance)
        .forRoutes({ path: path.replace('/*path', ''), method: RequestMethod.ALL });
    }
  }
}