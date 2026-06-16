import { Injectable, NestMiddleware } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { firstValueFrom } from 'rxjs';
import type { Request, Response, NextFunction } from 'express';

const PUBLIC_ROUTES = [
  { path: '/auth/login', method: 'POST' },
  { path: '/user', method: 'POST' },
  { path: '/auth/logout', method: 'POST' },
];

const RATE_LIMIT = 100;
const WINDOW_SEC = 60;

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // console.log(`[AuthMiddleware] ${req.method} ${req.url}`);
    // rate limit
    const ip =
      (req.headers['x-forwarded-for'] as string) ??
      req.socket.remoteAddress ??
      'unknown';
    const key = `rate_limit:${ip}`;
    const requests = await this.redisService.increment(key);

    if (requests === 1) {
      await this.redisService.expire(key, WINDOW_SEC);
    }

    if (requests > RATE_LIMIT) {
      const ttl = await this.redisService.ttl(key);
      res.status(429).json({
        statusCode: 429,
        message: `Muitas requisições. Tente novamente em ${ttl} segundos.`,
        error: 'Too Many Requests',
      });
      return;
    }

    // autenticação
    const isPublic = PUBLIC_ROUTES.some(
      (route) => req.url === route.path && req.method === route.method,
    );

    if (isPublic) return next();

    const token = req.headers['token'] as string;
    if (!token) {
      res.status(401).json({ message: 'Token não fornecido' });
      return;
    }

    try {
      const authServer = this.configService.get<string>('AUTH_SERVER');

      const { data } = await firstValueFrom(
        this.httpService.post(
          `${authServer}/auth/validaToken`,
          {},
          { headers: { token } },
        ),
      );

      // injeta o usuário na request
      (req as any).user = data;

      // repassa os dados do usuário para os serviços internos
      req.headers['x-user-id'] = data.id;
      req.headers['x-user-role'] = data.role;
      req.headers['x-user-email'] = data.email;
      next();
    } catch (err: any) {
      if (err.response?.status === 401) {
        res.status(401).json({ message: 'Token inválido' });
        return;
      }
      res.status(503).json({ message: 'Auth service indisponível' });
    }
  }
}
