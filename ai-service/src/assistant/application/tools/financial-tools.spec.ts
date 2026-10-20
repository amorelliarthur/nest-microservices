import { FinancialDataService } from '../../../financial/application/financial-data.service';
import type { FinancialClient } from '../../../financial/domain/financial-client.port';
import { FinancialServiceError } from '../../../financial/domain/financial-service.error';
import type {
  FinancialTransaction,
  FinancialTransactionType,
} from '../../../financial/domain/financial.types';
import { FakeFinancialClient } from '../../../financial/testing/fake-financial.client';
import { createFinancialTools, MAX_TRANSACTIONS } from './financial-tools';
import { ToolRegistry } from './tool-registry';
import type { ToolResult } from './tool-registry';

interface TransactionsOutput {
  summary: {
    count: number;
    totalIn: number;
    totalSpent: number;
    totalTransfersOut: number;
    net: number;
  };
  transactions: { date: string; description: string | null }[];
  truncated: boolean;
}

// A descrição carrega o id, para identificarmos cada transação no resultado
const tx = (
  id: string,
  type: FinancialTransactionType,
  amount: number,
  createdAt: string,
): FinancialTransaction => ({
  id,
  accountId: 'acc-1',
  type,
  amount,
  description: id,
  createdAt: new Date(createdAt),
});

const makeSut = (client: FinancialClient) =>
  new ToolRegistry(createFinancialTools(new FinancialDataService(client)));

const run = (
  registry: ToolRegistry,
  name: string,
  args: Record<string, unknown> = {},
) =>
  registry.execute(
    { id: 'call-1', name, arguments: args },
    { userId: 'user-1' },
  );

const outputOf = (result: ToolResult): TransactionsOutput => {
  if (!result.ok) throw new Error(result.error);
  return result.output as TransactionsOutput;
};

const october = new FakeFinancialClient(
  {
    'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 1500.5 }],
    'user-2': [{ id: 'acc-2', type: 'CHECKING', balance: 99 }],
  },
  {
    'acc-1': [
      tx('t1', 'DEPOSIT', 1000.1, '2026-09-30T12:00:00Z'),
      tx('t2', 'WITHDRAWAL', 0.1, '2026-10-01T00:00:00Z'),
      tx('t3', 'WITHDRAWAL', 0.2, '2026-10-31T23:30:00Z'),
      tx('t4', 'DEPOSIT', 500, '2026-10-15T10:00:00Z'),
      tx('t5', 'TRANSFER', 99.99, '2026-11-01T00:00:00Z'),
    ],
  },
);

describe('financial tools', () => {
  it('list_accounts returns the accounts of the user in the context', async () => {
    await expect(run(makeSut(october), 'list_accounts')).resolves.toEqual({
      ok: true,
      output: [{ id: 'acc-1', type: 'CHECKING', balance: 1500.5 }],
    });
  });

  it('get_balance returns the balance of an own account', async () => {
    await expect(
      run(makeSut(october), 'get_balance', { accountId: 'acc-1' }),
    ).resolves.toEqual({
      ok: true,
      output: { accountId: 'acc-1', type: 'CHECKING', balance: 1500.5 },
    });
  });

  it('get_balance hides accounts of other users', async () => {
    await expect(
      run(makeSut(october), 'get_balance', { accountId: 'acc-2' }),
    ).resolves.toEqual({ ok: false, error: 'Account not found' });
  });

  it('list_transactions includes the whole last day of the period', async () => {
    const output = outputOf(
      await run(makeSut(october), 'list_transactions', {
        accountId: 'acc-1',
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    );

    expect(output.transactions.map((t) => t.description)).toEqual([
      't3',
      't4',
      't2',
    ]);
  });

  it('list_transactions computes the totals in code, in cents', async () => {
    const output = outputOf(
      await run(makeSut(october), 'list_transactions', {
        accountId: 'acc-1',
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    );

    expect(output.summary).toEqual({
      count: 3,
      totalIn: 500,
      totalSpent: 0.3,
      totalTransfersOut: 0,
      net: 499.7,
    });
  });

  it('list_transactions separates transfers from spending', async () => {
    const client = new FakeFinancialClient(
      { 'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 0 }] },
      {
        'acc-1': [
          tx('t1', 'DEPOSIT', 1000, '2026-10-01T10:00:00Z'),
          tx('t2', 'WITHDRAWAL', 312.45, '2026-10-02T10:00:00Z'),
          tx('t3', 'TRANSFER', 500, '2026-10-03T10:00:00Z'),
        ],
      },
    );

    const output = outputOf(
      await run(makeSut(client), 'list_transactions', { accountId: 'acc-1' }),
    );

    expect(output.summary).toEqual({
      count: 3,
      totalIn: 1000,
      totalSpent: 312.45,
      totalTransfersOut: 500,
      net: 187.55,
    });
  });

  it('list_transactions returns the most recent first and truncates, summarizing all', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      tx(
        `t${i}`,
        'WITHDRAWAL',
        1,
        new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      ),
    );
    const client = new FakeFinancialClient(
      { 'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 0 }] },
      { 'acc-1': many },
    );

    const output = outputOf(
      await run(makeSut(client), 'list_transactions', { accountId: 'acc-1' }),
    );

    expect(output.transactions).toHaveLength(MAX_TRANSACTIONS);
    expect(output.transactions[0].description).toBe('t59');
    expect(output.truncated).toBe(true);
    expect(output.summary.count).toBe(60);
  });

  it('list_transactions rejects dates outside the YYYY-MM-DD format', async () => {
    const result = await run(makeSut(october), 'list_transactions', {
      accountId: 'acc-1',
      from: '01/10/2026',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('from');
  });

  it('reports the financial service as unavailable without leaking details', async () => {
    const failing: FinancialClient = {
      listAccounts: () => Promise.reject(new FinancialServiceError('HTTP 500')),
      listTransactions: () =>
        Promise.reject(new FinancialServiceError('HTTP 500')),
    };

    await expect(run(makeSut(failing), 'list_accounts')).resolves.toEqual({
      ok: false,
      error: 'Financial service is unavailable. Try again later.',
    });
  });
});
