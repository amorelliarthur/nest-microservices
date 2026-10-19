export type FinancialTransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

export interface FinancialAccount {
  id: string;
  type: 'CHECKING' | 'SAVINGS';
  balance: number;
}

export interface FinancialTransaction {
  id: string;
  accountId: string;
  type: FinancialTransactionType;
  amount: number;
  description: string | null;
  createdAt: Date;
}
