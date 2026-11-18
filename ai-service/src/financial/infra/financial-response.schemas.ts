import { z } from 'zod';

// Campos não listados (userId, active, targetAccountId...) são descartados: só sai o que usamos
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
  // Usado só para o filtro de concluídas e descartado em seguida. É um enum
  // para que um status novo (que talvez movimente dinheiro) falhe alto e
  // apareça no log, em vez de sumir calado dos totais
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']),
  createdAt: z.coerce.date(),
});
