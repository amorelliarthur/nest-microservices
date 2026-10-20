import { z } from 'zod';

// Campos não listados (userId, active, status...) são descartados: só sai o que usamos
export const accountResponseSchema = z.object({
  id: z.string(),
  type: z.enum(['CHECKING', 'SAVINGS']),
  balance: z.coerce.number(),
});

export const transactionResponseSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']),
  amount: z.coerce.number(),
  description: z.string().nullable(),
  createdAt: z.coerce.date(),
});
