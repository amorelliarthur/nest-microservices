import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { InternalTokenVerifier } from '../common/auth/internal-token.verifier';
import { createInternalTokenTestKit } from '../common/auth/testing/internal-token.testing';

describe('AccountsController (HTTP)', () => {
  let app: INestApplication<App>;
  const tokens = createInternalTokenTestKit();

  const accountsService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findById: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: accountsService },
        { provide: InternalTokenVerifier, useValue: tokens.verifier },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  it('GET /accounts/me deve listar as contas do usuário do token interno', async () => {
    const contas = [{ id: 'acc-1', userId: 'user-1', type: 'CHECKING' }];
    accountsService.findByUser.mockResolvedValue(contas);

    await request(app.getHttpServer())
      .get('/accounts/me')
      .set('x-internal-token', tokens.issue('user-1'))
      .expect(200)
      .expect(contas);

    expect(accountsService.findByUser).toHaveBeenCalledWith('user-1', {
      id: 'user-1',
      role: 'USER',
    });
    expect(accountsService.findById).not.toHaveBeenCalled();
  });

  it('deve ignorar os headers x-user-* e usar só a identidade do token', async () => {
    accountsService.findByUser.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/accounts/me')
      .set({
        'x-internal-token': tokens.issue('user-1'),
        'x-user-id': 'user-2',
        'x-user-role': 'ADMIN',
      })
      .expect(200);

    expect(accountsService.findByUser).toHaveBeenCalledWith('user-1', {
      id: 'user-1',
      role: 'USER',
    });
  });

  it('deve responder 401 com apenas os headers x-user-*, sem token interno', async () => {
    await request(app.getHttpServer())
      .get('/accounts/me')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'ADMIN' })
      .expect(401);

    expect(accountsService.findByUser).not.toHaveBeenCalled();
  });

  it('deve responder 401 com um token interno inválido', async () => {
    const outroEmissor = createInternalTokenTestKit();

    await request(app.getHttpServer())
      .get('/accounts/me')
      .set('x-internal-token', outroEmissor.issue('user-1', 'ADMIN'))
      .expect(401);

    expect(accountsService.findByUser).not.toHaveBeenCalled();
  });

  it('DELETE /accounts/:id deve responder 401 sem token interno', async () => {
    await request(app.getHttpServer()).delete('/accounts/acc-1').expect(401);

    expect(accountsService.remove).not.toHaveBeenCalled();
  });
});
