import { join } from 'path';
import { DataSource } from 'typeorm';
import { Account } from '../../src/accounts/entities/account.entity';
import { Transaction } from '../../src/transactions/entities/transaction.entity';

// O global-setup já conferiu que o banco conectado termina em _test
const url = process.env.TEST_DATABASE_URL;

// Instante fixo, gravado pelo próprio banco: o teste confere que a leitura
// devolve o mesmo instante com o processo do Node fora de UTC (Asia/Tokyo).
const INSTANT = '2026-01-15T12:00:00.000Z';

describe('created_at e updated_at (integration)', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    url,
    entities: [Account, Transaction],
    migrations: [join(__dirname, '../../src/migrations/*.ts')],
  });

  beforeAll(async () => {
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE transactions, accounts');
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('deve rodar com o processo num fuso à frente de UTC', () => {
    expect(new Date().getTimezoneOffset()).toBe(-9 * 60);
  });

  it('deve ler o createdAt e o updatedAt da conta como o instante gravado', async () => {
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO accounts (user_id, created_at, updated_at)
       VALUES ($1, $2::timestamptz, $2::timestamptz)
       RETURNING id`,
      ['user-1', INSTANT],
    );

    const account = await dataSource
      .getRepository(Account)
      .findOneByOrFail({ id: rows[0].id });

    expect(account.createdAt.toISOString()).toBe(INSTANT);
    expect(account.updatedAt.toISOString()).toBe(INSTANT);
  });

  it('deve ler o createdAt da transação como o instante gravado', async () => {
    const accounts: { id: string }[] = await dataSource.query(
      `INSERT INTO accounts (user_id) VALUES ($1) RETURNING id`,
      ['user-1'],
    );
    const rows: { id: string }[] = await dataSource.query(
      `INSERT INTO transactions (account_id, type, amount, created_at)
       VALUES ($1, 'DEPOSIT', 10, $2::timestamptz)
       RETURNING id`,
      [accounts[0].id, INSTANT],
    );

    const transaction = await dataSource
      .getRepository(Transaction)
      .findOneByOrFail({ id: rows[0].id });

    expect(transaction.createdAt.toISOString()).toBe(INSTANT);
  });
});
