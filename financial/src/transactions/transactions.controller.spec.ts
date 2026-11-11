import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { InternalTokenVerifier } from '../common/auth/internal-token.verifier';
import { createInternalTokenTestKit } from '../common/auth/testing/internal-token.testing';

describe('TransactionsController (HTTP)', () => {
  let app: INestApplication<App>;
  const tokens = createInternalTokenTestKit();

  const transactionsService = {
    create: jest.fn(),
    findByAccount: jest.fn(),
    getBalance: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: transactionsService },
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

  it('GET /transactions/account/:id/balance deve usar o usuário do token interno', async () => {
    transactionsService.getBalance.mockResolvedValue({ balance: 100 });

    await request(app.getHttpServer())
      .get('/transactions/account/acc-1/balance')
      .set({
        'x-internal-token': tokens.issue('user-1'),
        'x-user-role': 'ADMIN',
      })
      .expect(200)
      .expect({ balance: 100 });

    expect(transactionsService.getBalance).toHaveBeenCalledWith('acc-1', {
      id: 'user-1',
      role: 'USER',
    });
  });

  it('POST /transactions deve responder 401 sem token interno, mesmo com x-user-*', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'ADMIN' })
      .send({ accountId: 'acc-1', type: 'WITHDRAW', amount: 100 })
      .expect(401);

    expect(transactionsService.create).not.toHaveBeenCalled();
  });

  it('GET /transactions/account/:id deve responder 401 com token interno inválido', async () => {
    await request(app.getHttpServer())
      .get('/transactions/account/acc-1')
      .set('x-internal-token', 'token-forjado')
      .expect(401);

    expect(transactionsService.findByAccount).not.toHaveBeenCalled();
  });
});
