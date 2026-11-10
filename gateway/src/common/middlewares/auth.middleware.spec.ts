import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import type { Request, Response } from 'express';
import { AuthMiddleware } from './auth.middleware';
import { RedisService } from '../redis/redis.service';

const GATEWAY_SECRET = 'segredo-compartilhado-com-pelo-menos-32-caracteres';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let httpService: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let redisService: { increment: jest.Mock; expire: jest.Mock; ttl: jest.Mock };
  let loggerSpies: jest.SpyInstance[];

  // helper para montar um mock de Request do Express com o mínimo necessário
  const buildRequest = (overrides: Partial<Request> = {}): Request => {
    return {
      url: '/user/me',
      method: 'GET',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' } as any,
      ...overrides,
    } as Request;
  };

  // helper para montar um mock de Response com status().json() encadeáveis
  const buildResponse = (): Response => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthMiddleware,
        { provide: HttpService, useValue: { post: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://auth:3001') },
        },
        {
          provide: RedisService,
          useValue: { increment: jest.fn(), expire: jest.fn(), ttl: jest.fn() },
        },
        { provide: 'GATEWAY_SHARED_SECRET', useValue: GATEWAY_SECRET },
      ],
    }).compile();

    middleware = module.get<AuthMiddleware>(AuthMiddleware);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    redisService = module.get(RedisService);

    // por padrão, simula que a requisição está bem dentro do limite (1ª do IP)
    redisService.increment.mockResolvedValue(1);

    loggerSpies = [
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // tudo o que foi registrado em log, inclusive objetos passados como argumento
  const allLogs = () =>
    loggerSpies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .map((value) => JSON.stringify(value) ?? String(value))
      .join('\n');

  describe('rate limiting', () => {
    it('deve incrementar o contador e definir o TTL na primeira requisição do IP', async () => {
      const req = buildRequest({ url: '/auth/login', method: 'POST' });
      const res = buildResponse();
      const next = jest.fn();
      redisService.increment.mockResolvedValue(1);

      await middleware.use(req, res, next);

      expect(redisService.increment).toHaveBeenCalledWith(
        'rate_limit:127.0.0.1',
      );
      expect(redisService.expire).toHaveBeenCalledWith(
        'rate_limit:127.0.0.1',
        60,
      );
      expect(next).toHaveBeenCalled();
    });

    it('não deve redefinir o TTL em requisições subsequentes dentro do limite', async () => {
      const req = buildRequest({ url: '/auth/login', method: 'POST' });
      const res = buildResponse();
      const next = jest.fn();
      redisService.increment.mockResolvedValue(42);

      await middleware.use(req, res, next);

      expect(redisService.expire).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('deve retornar 429 quando o limite de requisições é excedido', async () => {
      const req = buildRequest({ url: '/user/me', method: 'GET' });
      const res = buildResponse();
      const next = jest.fn();
      redisService.increment.mockResolvedValue(101);
      redisService.ttl.mockResolvedValue(35);

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          message: expect.stringContaining('35'),
        }),
      );
      expect(next).not.toHaveBeenCalled();
      // nem deveria chegar a verificar autenticação
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('deve usar x-forwarded-for como identificador de IP quando presente', async () => {
      const req = buildRequest({
        url: '/auth/login',
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.5' },
      });
      const res = buildResponse();
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(redisService.increment).toHaveBeenCalledWith(
        'rate_limit:203.0.113.5',
      );
    });
  });

  describe('rotas públicas', () => {
    it.each([
      ['/auth/login', 'POST'],
      ['/user', 'POST'],
      ['/auth/logout', 'POST'],
    ])(
      'deve chamar next() sem validar token para %s %s',
      async (path, method) => {
        const req = buildRequest({ url: path, method });
        const res = buildResponse();
        const next = jest.fn();

        await middleware.use(req, res, next);

        expect(httpService.post).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
      },
    );

    it.each([
      ['/auth/login', 'POST'],
      ['/user', 'POST'],
      ['/auth/logout', 'POST'],
    ])(
      'deve remover os headers internos enviados pelo cliente em %s %s',
      async (path, method) => {
        const req = buildRequest({
          url: path,
          method,
          headers: {
            'x-user-id': 'user-1',
            'x-user-role': 'ADMIN',
            'x-user-email': 'arthur@user.br',
            'x-internal-token': 'token-forjado',
            'x-gateway-secret': 'segredo-forjado',
          },
        });
        const res = buildResponse();
        const next = jest.fn();

        await middleware.use(req, res, next);

        expect(req.headers['x-gateway-secret']).toBeUndefined();
        expect(req.headers['x-user-id']).toBeUndefined();
        expect(req.headers['x-user-role']).toBeUndefined();
        expect(req.headers['x-user-email']).toBeUndefined();
        expect(req.headers['x-internal-token']).toBeUndefined();
        expect(next).toHaveBeenCalled();
      },
    );

    it('não deve tratar como pública uma rota com mesmo path mas método diferente', async () => {
      // /user é pública apenas para POST — um GET não deve passar direto
      const req = buildRequest({ url: '/user', method: 'GET', headers: {} });
      const res = buildResponse();
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('autenticação', () => {
    it('deve retornar 401 quando o token não é fornecido em rota protegida', async () => {
      const req = buildRequest({ url: '/user/me', method: 'GET', headers: {} });
      const res = buildResponse();
      const next = jest.fn();

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Token não fornecido' });
      expect(next).not.toHaveBeenCalled();
    });

    it('deve injetar os headers x-user-* e chamar next() quando o token é válido', async () => {
      const req = buildRequest({
        url: '/user/me',
        method: 'GET',
        headers: { token: 'token-valido' },
      });
      const res = buildResponse();
      const next = jest.fn();
      const payload = {
        id: 'user-1',
        role: 'ADMIN',
        email: 'arthur@user.br',
        internalToken: 'token-interno',
      };
      httpService.post.mockReturnValue(of({ data: payload }));

      await middleware.use(req, res, next);

      // o segredo vai só nas opções desta chamada, nunca em req.headers
      expect(httpService.post).toHaveBeenCalledWith(
        'http://auth:3001/internal/validate',
        {},
        {
          headers: {
            token: 'token-valido',
            'x-gateway-secret': GATEWAY_SECRET,
          },
          timeout: 3000,
        },
      );
      expect(req.headers['x-gateway-secret']).toBeUndefined();
      expect(req.headers['x-user-id']).toBe(payload.id);
      expect(req.headers['x-user-role']).toBe(payload.role);
      expect(req.headers['x-user-email']).toBe(payload.email);
      expect(next).toHaveBeenCalled();
    });

    it('deve repassar o token interno emitido pelo auth-service', async () => {
      const req = buildRequest({
        url: '/financial/accounts/me',
        method: 'GET',
        headers: { token: 'token-valido' },
      });
      const res = buildResponse();
      const next = jest.fn();
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'user-1',
            role: 'USER',
            email: 'arthur@user.br',
            internalToken: 'token-interno',
          },
        }),
      );

      await middleware.use(req, res, next);

      expect(req.headers['x-internal-token']).toBe('token-interno');
      expect(next).toHaveBeenCalled();
    });

    it('deve substituir os headers internos forjados pelo cliente pelos do auth-service', async () => {
      const req = buildRequest({
        url: '/financial/accounts/me',
        method: 'GET',
        headers: {
          token: 'token-valido',
          'x-user-id': 'outro-usuario',
          'x-user-role': 'ADMIN',
          'x-user-extra': 'forjado',
          'x-internal-token': 'token-forjado',
          'x-gateway-secret': 'segredo-forjado',
        },
      });
      const res = buildResponse();
      const next = jest.fn();
      httpService.post.mockReturnValue(
        of({
          data: {
            id: 'user-1',
            role: 'USER',
            email: 'arthur@user.br',
            internalToken: 'token-interno',
          },
        }),
      );

      await middleware.use(req, res, next);

      expect(req.headers['x-user-id']).toBe('user-1');
      expect(req.headers['x-user-role']).toBe('USER');
      expect(req.headers['x-user-extra']).toBeUndefined();
      expect(req.headers['x-internal-token']).toBe('token-interno');
      expect(req.headers['x-gateway-secret']).toBeUndefined();
    });

    it('deve retornar 401 quando o auth-service responde com 401 (token inválido)', async () => {
      const req = buildRequest({
        url: '/user/me',
        method: 'GET',
        headers: { token: 'token-invalido' },
      });
      const res = buildResponse();
      const next = jest.fn();
      httpService.post.mockReturnValue(
        throwError(() => ({ response: { status: 401 } })),
      );

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Token inválido' });
      expect(next).not.toHaveBeenCalled();
    });

    it('deve retornar 503 quando o auth-service está indisponível', async () => {
      const req = buildRequest({
        url: '/user/me',
        method: 'GET',
        headers: { token: 'qualquer-token' },
      });
      const res = buildResponse();
      const next = jest.fn();
      httpService.post.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      await middleware.use(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Auth service indisponível',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('resposta e falhas do auth-service', () => {
    const protectedRequest = () =>
      buildRequest({
        url: '/financial/accounts/me',
        method: 'GET',
        headers: { token: 'token-valido' },
      });

    // erro do axios: config.headers carrega o segredo e nunca pode ir para o log
    const axiosError = (fields: Record<string, unknown>) => ({
      ...fields,
      config: {
        headers: { token: 'token-valido', 'x-gateway-secret': GATEWAY_SECRET },
      },
    });

    const validData = {
      id: 'user-1',
      role: 'USER',
      email: 'arthur@user.br',
      internalToken: 'token-interno',
    };

    it.each([
      ['sem internalToken', { ...validData, internalToken: undefined }],
      ['com internalToken vazio', { ...validData, internalToken: '' }],
      ['sem id', { ...validData, id: undefined }],
      ['sem role', { ...validData, role: undefined }],
      ['sem email', { ...validData, email: undefined }],
      ['com id que não é string', { ...validData, id: 123 }],
      ['vazia', undefined],
      ['em formato de string', 'ok'],
    ])(
      'deve retornar 503 sem repassar a requisição quando a resposta vem %s',
      async (_caso, data) => {
        const req = protectedRequest();
        const res = buildResponse();
        const next = jest.fn();
        httpService.post.mockReturnValue(of({ data }));

        await middleware.use(req, res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Auth service indisponível',
        });
        expect(next).not.toHaveBeenCalled();
        expect(req.headers['x-user-id']).toBeUndefined();
        expect(req.headers['x-internal-token']).toBeUndefined();
      },
    );

    it('deve retornar 503 e registrar ERROR sem o segredo quando o auth recusa o segredo do gateway (403)', async () => {
      const res = buildResponse();
      const next = jest.fn();
      httpService.post.mockReturnValue(
        throwError(() => axiosError({ response: { status: 403 } })),
      );

      await middleware.use(protectedRequest(), res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Auth service indisponível',
      });
      expect(next).not.toHaveBeenCalled();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('GATEWAY_SHARED_SECRET'),
      );
      expect(allLogs()).not.toContain(GATEWAY_SECRET);
    });

    it.each([
      ['responde 500', { response: { status: 500 } }],
      [
        'estoura o timeout',
        { code: 'ECONNABORTED', message: 'timeout of 3000ms exceeded' },
      ],
      [
        'recusa a conexão',
        { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' },
      ],
    ])(
      'deve retornar 503 sem registrar o segredo quando o auth %s',
      async (_caso, fields) => {
        const res = buildResponse();
        const next = jest.fn();
        httpService.post.mockReturnValue(throwError(() => axiosError(fields)));

        await middleware.use(protectedRequest(), res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(next).not.toHaveBeenCalled();
        expect(allLogs()).not.toContain(GATEWAY_SECRET);
      },
    );
  });
});
