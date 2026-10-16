import { z } from 'zod';

export const classifyTransactionSchema = z.object({
  description: z.string().trim().min(3).max(200),
});

export type ClassifyTransactionInput = z.infer<
  typeof classifyTransactionSchema
>;
