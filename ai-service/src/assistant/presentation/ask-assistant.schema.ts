import { z } from 'zod';

// Limite de tamanho: a pergunta vai para o modelo, e cada caractere custa tokens
export const askAssistantSchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export type AskAssistantInput = z.infer<typeof askAssistantSchema>;
