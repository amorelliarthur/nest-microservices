import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

describe('AccountsController (HTTP)', () => {
  let app: INestApplication<App>;

  const accountsService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    findById: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: accountsService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.resetAllMocks();
  });

  it('GET /accounts/me deve listar as contas do usuário da requisição', async () => {
    const contas = [{ id: 'acc-1', userId: 'user-1', type: 'CHECKING' }];
    accountsService.findByUser.mockResolvedValue(contas);

    await request(app.getHttpServer())
      .get('/accounts/me')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'USER' })
      .expect(200)
      .expect(contas);

    expect(accountsService.findByUser).toHaveBeenCalledWith('user-1', {
      id: 'user-1',
      role: 'USER',
    });
    expect(accountsService.findById).not.toHaveBeenCalled();
  });

  it('GET /accounts/me deve responder 401 sem o usuário da requisição', async () => {
    await request(app.getHttpServer()).get('/accounts/me').expect(401);

    expect(accountsService.findByUser).not.toHaveBeenCalled();
  });
});
