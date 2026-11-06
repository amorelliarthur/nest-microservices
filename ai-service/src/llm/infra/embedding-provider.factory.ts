import { GoogleGenAI } from '@google/genai';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { sleep } from '../../shared/sleep';
import { RetryingEmbeddingProvider } from '../application/retrying-embedding.provider';
import type { EmbeddingProvider } from '../domain/embedding-provider.port';
import { GeminiEmbeddingProvider } from './gemini-embedding.provider';

const DEFAULT_DIMENSIONS = 768;
// O índice HNSW do pgvector aceita até 2000 dimensões
const dimensionsSchema = z.coerce.number().int().positive().max(2000);

export const createEmbeddingProvider = (
  config: ConfigService,
): EmbeddingProvider => {
  const rawDimensions = config.get<string>('EMBEDDING_DIMENSIONS');
  const dimensions = dimensionsSchema.safeParse(
    rawDimensions ?? DEFAULT_DIMENSIONS,
  );
  if (!dimensions.success) {
    throw new Error(
      `Invalid EMBEDDING_DIMENSIONS "${rawDimensions}": expected a positive integer up to 2000`,
    );
  }

  const client = new GoogleGenAI({
    apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
  });
  return new RetryingEmbeddingProvider(
    new GeminiEmbeddingProvider(
      client,
      config.getOrThrow<string>('GEMINI_EMBEDDING_MODEL'),
      dimensions.data,
    ),
    sleep,
  );
};
