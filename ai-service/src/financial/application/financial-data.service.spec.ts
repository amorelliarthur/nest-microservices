import { AccountNotFoundError } from '../domain/account-not-found.error';
import type {
  FinancialAccount,
  FinancialTransaction,
  FinancialTransactionType,
} from '../domain/financial.types';
import { FakeFinancialClient } from '../testing/fake-financial.client';
import { FinancialDataService } from './financial-data.service';

const account = (id: string): FinancialAccount => ({
  id,
  type: 'CHECKING',
  balance: 100,
});

const tx = (
  id: string,
  type: FinancialTransactionType,
  createdAt: string,
  accountId = 'acc-1',
): FinancialTransaction => ({
  id,
  accountId,
  type,
  amount: 10,
  description: null,
  createdAt: new Date(createdAt),
});

const makeSut = () => {
  const client = new FakeFinancialClient(
    { 'user-1': [account('acc-1')], 'user-2': [account('acc-2')] },
    {
      'acc-1': [
        tx('t1', 'DEPOSIT', '2026-10-01T10:00:00Z'),
        tx('t2', 'WITHDRAWAL', '2026-10-15T10:00:00Z'),
        tx('t3', 'WITHDRAWAL', '2026-10-31T23:59:59Z'),
      ],
      'acc-2': [tx('t9', 'DEPOSIT', '2026-10-05T10:00:00Z', 'acc-2')],
    },
  );
  return { client, service: new FinancialDataService(client) };
};

describe('FinancialDataService', () => {
  it('lists the accounts of the user', async () => {
    const { service } = makeSut();

    await expect(service.listAccounts('user-1')).resolves.toEqual([
      account('acc-1'),
    ]);
  });

  it('returns an account that belongs to the user', async () => {
    const { service } = makeSut();

    await expect(service.getAccount('user-1', 'acc-1')).resolves.toEqual(
      account('acc-1'),
    );
  });

  it('throws AccountNotFoundError for an account of another user', async () => {
    const { service } = makeSut();

    await expect(service.getAccount('user-1', 'acc-2')).rejects.toThrow(
      AccountNotFoundError,
    );
  });

  it('never fetches transactions of an account the user does not own', async () => {
    const { client, service } = makeSut();

    await expect(service.listTransactions('user-1', 'acc-2')).rejects.toThrow(
      AccountNotFoundError,
    );
    expect(client.transactionRequests).toHaveLength(0);
  });

  it('returns all transactions when no filter is given', async () => {
    const { service } = makeSut();

    const result = await service.listTransactions('user-1', 'acc-1');

    expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
  });

  it('filters transactions by inclusive period and type', async () => {
    const { service } = makeSut();

    const result = await service.listTransactions('user-1', 'acc-1', {
      from: new Date('2026-10-10T00:00:00Z'),
      to: new Date('2026-10-31T23:59:59Z'),
      type: 'WITHDRAWAL',
    });

    expect(result.map((t) => t.id)).toEqual(['t2', 't3']);
  });
});
