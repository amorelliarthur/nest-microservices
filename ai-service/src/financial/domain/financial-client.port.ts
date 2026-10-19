import type { FinancialAccount, FinancialTransaction } from './financial.types';

export interface FinancialClient {
  listAccounts(userId: string): Promise<FinancialAccount[]>;
  listTransactions(
    userId: string,
    accountId: string,
  ): Promise<FinancialTransaction[]>;
}

export const FINANCIAL_CLIENT = Symbol('FINANCIAL_CLIENT');
