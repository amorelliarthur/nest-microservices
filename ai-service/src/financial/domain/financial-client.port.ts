import type { Caller } from '../../shared/auth/caller';
import type { FinancialAccount, FinancialTransaction } from './financial.types';

export interface FinancialClient {
  listAccounts(caller: Caller): Promise<FinancialAccount[]>;
  listTransactions(
    caller: Caller,
    accountId: string,
  ): Promise<FinancialTransaction[]>;
}

export const FINANCIAL_CLIENT = Symbol('FINANCIAL_CLIENT');
