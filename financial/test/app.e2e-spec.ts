import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { createInternalTokenTestKit } from '../src/common/auth/testing/internal-token.testing';
import { INTERNAL_TOKEN_HEADER } from '../src/common/auth/internal-token.guard';
import { QueueService } from '../src/common/queue/queue.service';
import { TransactionWorker } from '../src/common/queue/transaction.worker';
import { RabbitMQService } from '../src/common/rabbitmq/rabbitmq.service';
import { StalePendingSweeper } from '../src/transactions/stale-pending.sweeper';
import { assertTestDatabaseName } from './integration/test-database';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error('TEST_DATABASE_URL is not set');
}

// O ambiente vence o .env no ConfigModule: a app conecta no banco de testes
const db = new URL(testUrl);
Object.assign(process.env, {
  DB_HOST: db.hostname,
  DB_PORT: db.port || '5432',
  DB_USER: decodeURIComponent(db.username),
  DB_PASS: decodeURIComponent(db.password),
  DB_NAME: db.pathname.slice(1),
});

const kit = createInternalTokenTestKit();
process.env.INTERNAL_JWT_PUBLIC_KEY_B64 = kit.publicKeyBase64;

describe('Financial app (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Aplica as migrations no banco de testes, conferido antes de qualquer escrita
    const migrator = new DataSource({
      type: 'postgres',
      url: testUrl,
      migrations: [join(__dirname, '../src/migrations/*.ts')],
    });
    await migrator.initialize();
    try {
      const [{ name }]: { name: string }[] = await migrator.query(
        'SELECT current_database() AS name',
      );
      assertTestDatabaseName(name);
      await migrator.runMigrations();
    } finally {
      await migrator.destroy();
    }

    // Sem worker, fila, RabbitMQ e rotina de PENDING: o teste não consome
    // jobs de outra fila nem altera transações; só precisa do PostgreSQL
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TransactionWorker)
      .useValue({})
      .overrideProvider(StalePendingSweeper)
      .useValue({})
      .overrideProvider(QueueService)
      .useValue({})
      .overrideProvider(RabbitMQService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Confere o banco em que a app realmente conectou, antes de qualquer requisição
    const rows: { name: string }[] = await app
      .get(DataSource)
      .query('SELECT current_database() AS name');
    assertTestDatabaseName(rows[0].name);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('deve expor as métricas sem token', () => {
    return request(app.getHttpServer()).get('/metrics').expect(200);
  });

  it('deve recusar uma rota protegida sem o token interno', () => {
    return request(app.getHttpServer()).get('/accounts/me').expect(401);
  });

  it('deve listar as contas do usuário do token interno', () => {
    return request(app.getHttpServer())
      .get('/accounts/me')
      .set(INTERNAL_TOKEN_HEADER, kit.issue(randomUUID()))
      .expect(200)
      .expect([]);
  });
});
