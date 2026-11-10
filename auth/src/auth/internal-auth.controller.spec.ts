import { Test } from '@nestjs/testing';
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

  it('deve retornar 401 sem chamar o service quando o segredo do gateway não é enviado', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/validate')
      .set('token', 'jwt-do-cliente');

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('internalToken');
    expect(mockAuthService.validateForGateway).not.toHaveBeenCalled();
  });

  it('deve retornar 401 sem chamar o service quando o segredo do gateway está errado', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/validate')
      .set('token', 'jwt-do-cliente')
      .set('x-gateway-secret', 'segredo-errado');

    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('internalToken');
    expect(mockAuthService.validateForGateway).not.toHaveBeenCalled();
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
