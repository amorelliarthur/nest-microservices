import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { firstValueFrom } from 'rxjs';
import type { Request, Response, NextFunction } from 'express';
import { GATEWAY_SECRET } from '../gateway-secret';

const PUBLIC_ROUTES = [
  { path: '/auth/login', method: 'POST' },
  { path: '/user', method: 'POST' },
  { path: '/auth/logout', method: 'POST' },
];

// headers que só o gateway pode definir: os enviados pelo cliente são descartados
const INTERNAL_HEADER_PREFIX = 'x-user-';
const INTERNAL_TOKEN_HEADER = 'x-internal-token';
const GATEWAY_SECRET_HEADER = 'x-gateway-secret';

const AUTH_TIMEOUT_MS = 3000;

const RATE_LIMIT = 100;
const WINDOW_SEC = 60;

// formato retornado pelo auth-service em /internal/validate
interface GatewayValidationResponse {
  id: string;
  role: string;
  email: string;
  internalToken: string;
}

// estende o Request do Express para aceitar o usuário autenticado
interface RequestWithUser extends Request {
  user?: GatewayValidationResponse;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

// confere a resposta antes de usá-la: um campo faltando não pode virar header
const isValidResponse = (data: unknown): data is GatewayValidationResponse => {
  if (!data || typeof data !== 'object') return false;
  const { id, role, email, internalToken } = data as Record<string, unknown>;
  return [id, role, email, internalToken].every(isNonEmptyString);
};

// erro do axios: só o status e o code, nunca o objeto (config.headers tem o segredo)
interface AuthCallError {
  response?: { status?: number };
  code?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(GATEWAY_SECRET) private readonly gatewaySecret: string,
  ) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    // console.log(`[AuthMiddleware] ${req.method} ${req.url}`);
    this.stripInternalHeaders(req);

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

    let data: unknown;
    try {
      const authServer = this.configService.get<string>('AUTH_SERVER');

      // o segredo vai só nas opções desta chamada, nunca em req.headers
      ({ data } = await firstValueFrom(
        this.httpService.post<unknown>(
          `${authServer}/internal/validate`,
          {},
          {
            headers: { token, [GATEWAY_SECRET_HEADER]: this.gatewaySecret },
            timeout: AUTH_TIMEOUT_MS,
          },
        ),
      ));
    } catch (err: unknown) {
      const { response, code } = err as AuthCallError;

      if (response?.status === 401) {
        res.status(401).json({ message: 'Token inválido' });
        return;
      }

      if (response?.status === 403) {
        this.logger.error(
          'Auth service rejected the gateway secret: check GATEWAY_SHARED_SECRET',
        );
      } else {
        this.logger.warn(
          `Auth service call failed (status: ${response?.status ?? 'none'}, code: ${code ?? 'none'})`,
        );
      }
      res.status(503).json({ message: 'Auth service indisponível' });
      return;
    }

    if (!isValidResponse(data)) {
      this.logger.warn('Auth service returned an invalid validation response');
      res.status(503).json({ message: 'Auth service indisponível' });
      return;
    }

    // injeta o usuário na request
    req.user = data;

    // repassa os dados do usuário para os serviços internos
    req.headers['x-user-id'] = data.id;
    req.headers['x-user-role'] = data.role;
    req.headers['x-user-email'] = data.email;
    req.headers[INTERNAL_TOKEN_HEADER] = data.internalToken;
    next();
  }

  // vale para todas as rotas, inclusive as públicas
  private stripInternalHeaders(req: Request) {
    for (const name of Object.keys(req.headers)) {
      if (
        name.startsWith(INTERNAL_HEADER_PREFIX) ||
        name === INTERNAL_TOKEN_HEADER ||
        name === GATEWAY_SECRET_HEADER
      ) {
        delete req.headers[name];
      }
    }
  }
}
