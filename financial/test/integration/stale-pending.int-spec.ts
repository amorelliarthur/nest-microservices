import { join } from 'path';
import { DataSource } from 'typeorm';
import { Account } from '../../src/accounts/entities/account.entity';
import {
  Transaction,
  TransactionStatus,
} from '../../src/transactions/entities/transaction.entity';
import { TransactionsService } from '../../src/transactions/transactions.service';
import type { QueueService } from '../../src/common/queue/queue.service';
import type { RabbitMQService } from '../../src/common/rabbitmq/rabbitmq.service';

const url = process.env.TEST_DATABASE_URL;
// Os testes apagam as tabelas: só rodam num banco cujo nome termina em _test
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error(
    'TEST_DATABASE_URL must point to a database whose name ends with "_test"',
  );
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

describe('TransactionsService.failStalePending (integration)', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    entities: [Account, Transaction],
    migrations: [join(__dirname, '../../src/migrations/*.ts')],
  });
  let service: TransactionsService;
  let accountId: string;

  // created_at relativo ao relógio do banco, como no DEFAULT now() da coluna
  const insertTransaction = async (
    status: TransactionStatus,
    minutesAgo: number,
  ): Promise<string> => {
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO transactions (account_id, type, amount, status, created_at)
       VALUES ($1, 'DEPOSIT', 10, $2, now() - make_interval(mins => $3))
       RETURNING id`,
      [accountId, status, minutesAgo],
    );
    return rows[0].id;
  };

  const statusOf = async (id: string) =>
    (await dataSource.getRepository(Transaction).findOneByOrFail({ id }))
      .status;

  beforeAll(async () => {
    await dataSource.initialize();
    await dataSource.runMigrations();
    service = new TransactionsService(
      dataSource.getRepository(Transaction),
      dataSource.getRepository(Account),
      dataSource,
      {} as QueueService,
      {} as RabbitMQService,
    );
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE transactions, accounts');
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO accounts (user_id) VALUES ($1) RETURNING id`,
      ['user-1'],
    );
    accountId = rows[0].id;
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('deve rodar com o processo num fuso à frente de UTC', () => {
    expect(new Date().getTimezoneOffset()).toBe(-9 * 60);
  });

  it('deve encerrar só as PENDING criadas há mais de 10 minutos, em qualquer fuso do processo', async () => {
    const antiga = await insertTransaction(TransactionStatus.PENDING, 11);
    const recente = await insertTransaction(TransactionStatus.PENDING, 9);
    const concluida = await insertTransaction(TransactionStatus.COMPLETED, 60);

    const count = await service.failStalePending(TEN_MINUTES_MS);

    expect(count).toBe(1);
    expect(await statusOf(antiga)).toBe(TransactionStatus.FAILED);
    expect(await statusOf(recente)).toBe(TransactionStatus.PENDING);
    expect(await statusOf(concluida)).toBe(TransactionStatus.COMPLETED);
  });
});
