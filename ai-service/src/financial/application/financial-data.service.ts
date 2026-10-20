import { Inject, Injectable } from '@nestjs/common';
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

  listAccounts(userId: string): Promise<FinancialAccount[]> {
    return this.client.listAccounts(userId);
  }

  async getAccount(
    userId: string,
    accountId: string,
  ): Promise<FinancialAccount> {
    const accounts = await this.client.listAccounts(userId);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) throw new AccountNotFoundError(accountId);
    return account;
  }

  async listTransactions(
    userId: string,
    accountId: string,
    filter: TransactionFilter = {},
  ): Promise<FinancialTransaction[]> {
    // Verifica o dono ANTES de buscar: dados de contas alheias nunca entram no serviço
    await this.getAccount(userId, accountId);

    const transactions = await this.client.listTransactions(userId, accountId);

    return transactions.filter(
      (t) =>
        (!filter.from || t.createdAt >= filter.from) &&
        (!filter.to || t.createdAt <= filter.to) &&
        (!filter.type || t.type === filter.type),
    );
  }
}
