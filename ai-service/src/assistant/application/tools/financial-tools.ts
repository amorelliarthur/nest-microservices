import { z } from 'zod';
import type { FinancialDataService } from '../../../financial/application/financial-data.service';
import { AccountNotFoundError } from '../../../financial/domain/account-not-found.error';
import { FinancialServiceError } from '../../../financial/domain/financial-service.error';
import type { FinancialTransaction } from '../../../financial/domain/financial.types';
import { defineTool } from './tool';
import type { Tool } from './tool';
import { ToolError } from './tool.error';

export const MAX_TRANSACTIONS = 50;

// Traduz erros do domínio financeiro em mensagens seguras para o modelo
const safely = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AccountNotFoundError) {
      throw new ToolError('Account not found');
    }
    if (error instanceof FinancialServiceError) {
      throw new ToolError('Financial service is unavailable. Try again later.');
    }
    throw error;
  }
};

// Soma em centavos (inteiros) para evitar erros de ponto flutuante
const sumInCents = (transactions: FinancialTransaction[]): number =>
  transactions.reduce((sum, t) => sum + Math.round(t.amount * 100), 0);

// Transferências não são gastos: o modelo precisa receber os dois totais separados
const summarize = (transactions: FinancialTransaction[]) => {
  const ofType = (type: FinancialTransaction['type']) =>
    sumInCents(transactions.filter((t) => t.type === type));

  const inCents = ofType('DEPOSIT');
  const spentCents = ofType('WITHDRAWAL');
  const transfersCents = ofType('TRANSFER');

  return {
    count: transactions.length,
    totalIn: inCents / 100,
    totalSpent: spentCents / 100,
    totalTransfersOut: transfersCents / 100,
    net: (inCents - spentCents - transfersCents) / 100,
  };
};

const accountIdField = z
  .string()
  .min(1)
  .describe('Account id returned by list_accounts');

export const createFinancialTools = (
  financialData: FinancialDataService,
): Tool[] => [
  defineTool({
    name: 'list_accounts',
    description:
      'Lists the bank accounts of the current user, with type and current balance.',
    schema: z.object({}),
    execute: (_args, { userId }) =>
      safely(() => financialData.listAccounts(userId)),
  }),

  defineTool({
    name: 'get_balance',
    description:
      'Returns the current balance of one account of the current user.',
    schema: z.object({ accountId: accountIdField }),
    execute: ({ accountId }, { userId }) =>
      safely(async () => {
        const account = await financialData.getAccount(userId, accountId);
        return {
          accountId: account.id,
          type: account.type,
          balance: account.balance,
        };
      }),
  }),

  defineTool({
    name: 'list_transactions',
    description:
      'Lists transactions of one account of the current user, optionally filtered by period and type. ' +
      'The result includes a summary with totals already calculated: always use these totals instead of adding values yourself. ' +
      'totalSpent is the money spent (purchases, payments, withdrawals). ' +
      'totalTransfersOut is money transferred to other accounts and is NOT spending; report it separately.',
    schema: z.object({
      accountId: accountIdField,
      from: z.iso
        .date()
        .optional()
        .describe('Start date (YYYY-MM-DD), inclusive'),
      to: z.iso.date().optional().describe('End date (YYYY-MM-DD), inclusive'),
      type: z
        .enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'])
        .optional()
        .describe('DEPOSIT = money in; WITHDRAWAL and TRANSFER = money out'),
    }),
    execute: ({ accountId, from, to, type }, { userId }) =>
      safely(async () => {
        // Datas em UTC: "to" inclui o dia inteiro
        const transactions = await financialData.listTransactions(
          userId,
          accountId,
          {
            from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
            to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
            type,
          },
        );

        // Ordena aqui em vez de confiar na ordem do financial-service
        const sorted = [...transactions].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        );

        return {
          summary: summarize(sorted),
          // Limita o volume enviado ao modelo (tokens e custo)
          transactions: sorted.slice(0, MAX_TRANSACTIONS).map((t) => ({
            date: t.createdAt.toISOString().slice(0, 10),
            type: t.type,
            amount: t.amount,
            description: t.description,
          })),
          truncated: sorted.length > MAX_TRANSACTIONS,
        };
      }),
  }),
];
