import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from '../common/redis/redis.service';
import { InternalTokenIssuer } from '../internal-token/internal-token.issuer';
import { ServiceTokenIssuer } from '../internal-token/service-token.issuer';

// AuthService real: garante pela rota HTTP que a validação pública,
// encaminhada pelo gateway, nunca devolve o token interno
describe('AuthController (POST /auth/validaToken)', () => {
  let app: INestApplication<App>;
  const mockJwtService = { verify: jest.fn(), sign: jest.fn() };
  const mockRedisService = { isBlacklisted: jest.fn(), blacklist: jest.fn() };
  const mockInternalTokenIssuer = { issue: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: HttpService, useValue: { post: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: RedisService, useValue: mockRedisService },
        { provide: InternalTokenIssuer, useValue: mockInternalTokenIssuer },
        { provide: ServiceTokenIssuer, useValue: { issue: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.resetAllMocks());

  it('não deve emitir nem devolver o token interno', async () => {
    mockRedisService.isBlacklisted.mockResolvedValue(false);
    mockJwtService.verify.mockReturnValue({
      id: 'user-1',
      email: 'user@test.com',
      role: 'USER',
    });
    mockInternalTokenIssuer.issue.mockReturnValue('internal-token');

    const res = await request(app.getHttpServer())
      .post('/auth/validaToken')
      .set('token', 'jwt-do-cliente');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      role: 'USER',
    });
    expect(res.body).not.toHaveProperty('internalToken');
    expect(mockInternalTokenIssuer.issue).not.toHaveBeenCalled();
  });
});
