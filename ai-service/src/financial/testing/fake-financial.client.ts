import type { Caller } from '../../shared/auth/caller';
import type { FinancialClient } from '../domain/financial-client.port';
import type {
  FinancialAccount,
  FinancialTransaction,
} from '../domain/financial.types';

export class FakeFinancialClient implements FinancialClient {
  readonly transactionRequests: string[] = [];
  // Who made each request, in order: lets tests check the token is forwarded
  readonly callers: Caller[] = [];

  constructor(
    private readonly accountsByUser: Record<string, FinancialAccount[]>,
    private readonly transactionsByAccount: Record<
      string,
      FinancialTransaction[]
    > = {},
  ) {}

  listAccounts(caller: Caller): Promise<FinancialAccount[]> {
    this.callers.push(caller);
    return Promise.resolve(this.accountsByUser[caller.userId] ?? []);
  }

  listTransactions(
    caller: Caller,
    accountId: string,
  ): Promise<FinancialTransaction[]> {
    this.callers.push(caller);
    this.transactionRequests.push(accountId);
    return Promise.resolve(this.transactionsByAccount[accountId] ?? []);
  }
}
