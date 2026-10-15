import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { LLM_PROVIDER } from '../domain/llm-provider.port';
import type { LlmMessage, LlmProvider } from '../domain/llm-provider.port';
import { StructuredOutputError } from '../domain/structured-output.error';

export interface StructuredOutputOptions<T> {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  maxAttempts?: number;
}

type ParseResult<T> =
  { success: true; data: T } | { success: false; error: string };

@Injectable()
export class StructuredOutputService {
  constructor(@Inject(LLM_PROVIDER) private readonly llm: LlmProvider) {}

  async generate<T>(options: StructuredOutputOptions<T>): Promise<T> {
    const maxAttempts = options.maxAttempts ?? 2;
    let messages: LlmMessage[] = [{ role: 'user', content: options.prompt }];
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { text } = await this.llm.generate({
        system: options.system,
        messages,
      });
      const result = this.parse(text, options.schema);

      if (result.success) return result.data;

      lastError = result.error;
      // Novo array a cada tentativa: nunca mutar o histórico que já foi enviado
      messages = [
        ...messages,
        { role: 'assistant', content: text },
        {
          role: 'user',
          content: `Sua resposta é inválida: ${result.error}. Responda novamente apenas com o JSON corrigido.`,
        },
      ];
    }

    throw new StructuredOutputError(lastError, maxAttempts);
  }

  private parse<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
    const cleaned = text.replace(/```(?:json)?/g, '').trim();

    let json: unknown;
    try {
      json = JSON.parse(cleaned);
    } catch {
      return { success: false, error: 'a resposta não é um JSON válido' };
    }

    const result = schema.safeParse(json);
    if (result.success) return { success: true, data: result.data };

    const issues = result.error.issues
      .map(
        (issue) =>
          `${issue.path.map(String).join('.') || '(raiz)'}: ${issue.message}`,
      )
      .join('; ');
    return { success: false, error: issues };
  }
}
