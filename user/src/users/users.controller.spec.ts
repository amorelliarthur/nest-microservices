import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { InternalTokenVerifier } from '../common/auth/internal-token.verifier';
import { createInternalTokenTestKit } from '../common/auth/testing/internal-token.testing';

describe('UsersController (HTTP)', () => {
  let app: INestApplication<App>;
  const tokens = createInternalTokenTestKit();

  const usersService = {
    create: jest.fn(),
    authenticate: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // headers que um atacante enviaria acessando a porta do serviço direto
  const headersForjados = { 'x-user-id': 'user-1', 'x-user-role': 'ADMIN' };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
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

  describe('GET /user/me', () => {
    it('deve buscar o usuário do token interno, ignorando x-user-*', async () => {
      usersService.findById.mockResolvedValue({ _id: 'user-1' });

      await request(app.getHttpServer())
        .get('/user/me')
        .set({
          'x-internal-token': tokens.issue('user-1'),
          'x-user-id': 'user-2',
        })
        .expect(200);

      expect(usersService.findById).toHaveBeenCalledWith('user-1');
    });

    it('deve responder 401 com apenas os headers x-user-*', async () => {
      await request(app.getHttpServer())
        .get('/user/me')
        .set(headersForjados)
        .expect(401);

      expect(usersService.findById).not.toHaveBeenCalled();
    });
  });

  describe('rotas de ADMIN', () => {
    it('GET /user deve permitir um token de ADMIN', async () => {
      usersService.findAll.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/user')
        .set('x-internal-token', tokens.issue('admin-1', 'ADMIN'))
        .expect(200);
    });

    it('GET /user deve responder 403 para um token de USER, mesmo com x-user-role ADMIN', async () => {
      await request(app.getHttpServer())
        .get('/user')
        .set({
          'x-internal-token': tokens.issue('user-1'),
          'x-user-role': 'ADMIN',
        })
        .expect(403);

      expect(usersService.findAll).not.toHaveBeenCalled();
    });

    it('GET /user/:id deve responder 401 com apenas os headers x-user-*', async () => {
      await request(app.getHttpServer())
        .get('/user/user-2')
        .set(headersForjados)
        .expect(401);

      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('deve responder 401 com um token assinado por outra chave', async () => {
      const outroEmissor = createInternalTokenTestKit();

      await request(app.getHttpServer())
        .get('/user')
        .set('x-internal-token', outroEmissor.issue('admin-1', 'ADMIN'))
        .expect(401);

      expect(usersService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('rotas do dono ou ADMIN', () => {
    it('PATCH /user/:id deve permitir o dono do token', async () => {
      usersService.update.mockResolvedValue({ _id: 'user-1' });

      await request(app.getHttpServer())
        .patch('/user/user-1')
        .set('x-internal-token', tokens.issue('user-1'))
        .send({ nome: 'Ana' })
        .expect(200);

      expect(usersService.update).toHaveBeenCalledWith('user-1', {
        nome: 'Ana',
      });
    });

    it('PATCH /user/:id deve responder 403 para outro usuário, mesmo com x-user-id do dono', async () => {
      await request(app.getHttpServer())
        .patch('/user/user-1')
        .set({
          'x-internal-token': tokens.issue('user-2'),
          'x-user-id': 'user-1',
        })
        .send({ nome: 'Ana' })
        .expect(403);

      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('DELETE /user/:id deve permitir um ADMIN', async () => {
      await request(app.getHttpServer())
        .delete('/user/user-1')
        .set('x-internal-token', tokens.issue('admin-1', 'ADMIN'))
        .expect(204);

      expect(usersService.remove).toHaveBeenCalledWith('user-1');
    });

    it('DELETE /user/:id deve responder 401 com apenas os headers x-user-*', async () => {
      await request(app.getHttpServer())
        .delete('/user/user-1')
        .set(headersForjados)
        .expect(401);

      expect(usersService.remove).not.toHaveBeenCalled();
    });
  });

  describe('rotas sem token interno', () => {
    it('POST /user (cadastro público) não deve exigir token', async () => {
      usersService.create.mockResolvedValue({ _id: 'user-1' });

      await request(app.getHttpServer())
        .post('/user')
        .send({ nome: 'Ana' })
        .expect(201);
    });
  });

  describe('POST /user/authenticate (só o auth, no login)', () => {
    const credenciais = { email: 'ana@example.com', senha: 'Teste@123' };

    it('deve autenticar com o token de serviço do auth', async () => {
      usersService.authenticate.mockResolvedValue({ _id: 'user-1' });

      await request(app.getHttpServer())
        .post('/user/authenticate')
        .set('x-service-token', tokens.issueService())
        .send(credenciais)
        .expect(200);

      expect(usersService.authenticate).toHaveBeenCalledWith(
        credenciais.email,
        credenciais.senha,
      );
    });

    it('deve responder 401 sem o token de serviço', async () => {
      await request(app.getHttpServer())
        .post('/user/authenticate')
        .send(credenciais)
        .expect(401);

      expect(usersService.authenticate).not.toHaveBeenCalled();
    });

    it('deve responder 401 com um token interno de usuário, mesmo de ADMIN', async () => {
      await request(app.getHttpServer())
        .post('/user/authenticate')
        .set({
          'x-service-token': tokens.issue('admin-1', 'ADMIN'),
          'x-internal-token': tokens.issue('admin-1', 'ADMIN'),
        })
        .send(credenciais)
        .expect(401);

      expect(usersService.authenticate).not.toHaveBeenCalled();
    });

    it('deve responder 401 com um token de serviço de outro serviço', async () => {
      await request(app.getHttpServer())
        .post('/user/authenticate')
        .set('x-service-token', tokens.issueService('financial-service'))
        .send(credenciais)
        .expect(401);

      expect(usersService.authenticate).not.toHaveBeenCalled();
    });
  });
});
