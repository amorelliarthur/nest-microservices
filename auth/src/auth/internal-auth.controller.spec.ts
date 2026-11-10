import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { InternalAuthController } from './internal-auth.controller';
import { AuthService } from './auth.service';
import { GatewaySecretGuard } from '../internal-token/gateway-secret.guard';
import {
  GATEWAY_SECRET_VERIFIER,
  createGatewaySecretVerifier,
} from '../internal-token/gateway-secret';

const SECRET = 'segredo-compartilhado-com-pelo-menos-32-caracteres';

describe('InternalAuthController (POST /internal/validate)', () => {
  let app: INestApplication<App>;
  const mockAuthService = { validateForGateway: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InternalAuthController],
      providers: [
        GatewaySecretGuard,
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: GATEWAY_SECRET_VERIFIER,
          useValue: createGatewaySecretVerifier(SECRET),
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.resetAllMocks());

  // 403, e não 401: segredo errado é falha de configuração entre gateway e
  // auth, e não pode ser confundido com o token inválido de um cliente
  it.each([
    ['não é enviado', undefined],
    ['está vazio', ''],
    ['está errado', 'segredo-errado'],
    ['vem repetido', [SECRET, SECRET]],
  ])(
    'deve retornar 403 sem chamar o service quando o segredo do gateway %s',
    async (_caso, secret) => {
      const req = request(app.getHttpServer())
        .post('/internal/validate')
        .set('token', 'jwt-do-cliente');
      if (secret !== undefined) req.set('x-gateway-secret', secret);

      const res = await req;

      expect(res.status).toBe(403);
      expect(res.body).not.toHaveProperty('internalToken');
      expect(mockAuthService.validateForGateway).not.toHaveBeenCalled();
    },
  );

  it('deve retornar 401 quando o segredo está correto mas o token do cliente é inválido', async () => {
    mockAuthService.validateForGateway.mockRejectedValue(
      new UnauthorizedException('Token inválido'),
    );

    const res = await request(app.getHttpServer())
      .post('/internal/validate')
      .set('token', 'jwt-invalido')
      .set('x-gateway-secret', SECRET);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({ message: 'Token inválido' }),
    );
    expect(res.body).not.toHaveProperty('internalToken');
  });

  it('deve retornar a identidade e o token interno quando o segredo do gateway está correto', async () => {
    const identity = {
      id: 'user-1',
      role: 'USER',
      email: 'user@test.com',
      internalToken: 'internal-token',
    };
    mockAuthService.validateForGateway.mockResolvedValue(identity);

    const res = await request(app.getHttpServer())
      .post('/internal/validate')
      .set('token', 'jwt-do-cliente')
      .set('x-gateway-secret', SECRET);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(identity);
    expect(mockAuthService.validateForGateway).toHaveBeenCalledWith(
      'jwt-do-cliente',
    );
  });
});
