import { Inject, Injectable } from '@nestjs/common';
import type { Caller } from '../../shared/auth/caller';
import { AccountNotFoundError } from '../domain/account-not-found.error';
import { FINANCIAL_CLIENT } from '../domain/financial-client.port';
import type { FinancialClient } from '../domain/financial-client.port';
import type {
  FinancialAccount,
  FinancialTransaction,
  FinancialTransactionType,
} from '../domain/financial.types';

export interface TransactionFilter {
  from?: Date;
  to?: Date;
  type?: FinancialTransactionType;
}

@Injectable()
export class FinancialDataService {
  constructor(
    @Inject(FINANCIAL_CLIENT) private readonly client: FinancialClient,
  ) {}

  listAccounts(caller: Caller): Promise<FinancialAccount[]> {
    return this.client.listAccounts(caller);
  }

  async getAccount(
    caller: Caller,
    accountId: string,
  ): Promise<FinancialAccount> {
    const accounts = await this.client.listAccounts(caller);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    return account;
  }

  async listTransactions(
    caller: Caller,
    accountId: string,
    filter: TransactionFilter = {},
  ): Promise<FinancialTransaction[]> {
    // Verifica o dono ANTES de buscar: dados de contas alheias nunca entram no serviço
    await this.getAccount(caller, accountId);

    const transactions = await this.client.listTransactions(caller, accountId);

    return transactions.filter(
      (t) =>
        (!filter.from || t.createdAt >= filter.from) &&
        (!filter.to || t.createdAt <= filter.to) &&
        (!filter.type || t.type === filter.type),
    );
  }
}
