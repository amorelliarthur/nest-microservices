import { Logger } from '@nestjs/common';
import type { Sleep } from '../../shared/sleep';
import type {
  EmbeddingProvider,
  EmbeddingPurpose,
} from '../domain/embedding-provider.port';
import { retryWithBackoff } from './retry-with-backoff';
import type { RetryOptions } from './retry-with-backoff';

// Sem fallback de modelo: vetores de outro modelo não são comparáveis aos do banco
export class RetryingEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(RetryingEmbeddingProvider.name);

  constructor(
    private readonly inner: EmbeddingProvider,
    private readonly sleep: Sleep,
    private readonly options: RetryOptions = {
      maxAttempts: 3,
      baseDelayMs: 500,
    },
    private readonly random: () => number = Math.random,
  ) {}

  get model(): string {
    return this.inner.model;
  }

  get dimensions(): number {
    return this.inner.dimensions;
  }

  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    return retryWithBackoff(
      () => this.inner.embed(texts, purpose),
      this.options,
      {
        sleep: this.sleep,
        random: this.random,
        logger: this.logger,
        label: 'embedding call',
      },
    );
  }
}
