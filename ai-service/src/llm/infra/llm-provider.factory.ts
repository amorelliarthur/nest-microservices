import { GoogleGenAI } from '@google/genai';
import type { ConfigService } from '@nestjs/config';
import { sleep } from '../../shared/sleep';
import { RetryingLlmProvider } from '../application/retrying-llm.provider';
import type { LlmProvider } from '../domain/llm-provider.port';
import { GeminiProvider } from './gemini.provider';

// Monta a cadeia de providers a partir da configuração
export const createLlmProvider = (config: ConfigService): LlmProvider => {
  const client = new GoogleGenAI({
    apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
  });
  return new RetryingLlmProvider(
    new GeminiProvider(client, config.getOrThrow<string>('GEMINI_MODEL')),
    sleep,
  );
};
