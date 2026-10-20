import type { FinancialClient } from '../domain/financial-client.port';
import type {
  FinancialAccount,
  FinancialTransaction,
} from '../domain/financial.types';

export class FakeFinancialClient implements FinancialClient {
  readonly transactionRequests: string[] = [];

  constructor(
    private readonly accountsByUser: Record<string, FinancialAccount[]>,
    private readonly transactionsByAccount: Record<
      string,
      FinancialTransaction[]
    > = {},
  ) {}

  listAccounts(userId: string): Promise<FinancialAccount[]> {
    return Promise.resolve(this.accountsByUser[userId] ?? []);
  }

  listTransactions(
    _userId: string,
    accountId: string,
  ): Promise<FinancialTransaction[]> {
    this.transactionRequests.push(accountId);
    return Promise.resolve(this.transactionsByAccount[accountId] ?? []);
  }
}
