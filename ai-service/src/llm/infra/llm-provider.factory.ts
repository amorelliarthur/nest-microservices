import { GoogleGenAI } from '@google/genai';
import type { ConfigService } from '@nestjs/config';
import { sleep } from '../../shared/sleep';
import { FallbackLlmProvider } from '../application/fallback-llm.provider';
import { RetryingLlmProvider } from '../application/retrying-llm.provider';
import type { LlmProvider } from '../domain/llm-provider.port';
import { GeminiProvider } from './gemini.provider';

// Monta a cadeia de providers a partir da configuração
export const createLlmProvider = (config: ConfigService): LlmProvider => {
  const client = new GoogleGenAI({
    apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
  });
  const models = [
    config.getOrThrow<string>('GEMINI_MODEL'),
    config.get<string>('GEMINI_FALLBACK_MODEL'),
  ].filter((model): model is string => Boolean(model));

  // Cada modelo tem seu próprio retry; o fallback só entra quando as tentativas se esgotam
  return new FallbackLlmProvider(
    models.map(
      (model) =>
        new RetryingLlmProvider(new GeminiProvider(client, model), sleep),
    ),
  );
};
