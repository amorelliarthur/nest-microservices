import type { Logger } from '@nestjs/common';
import type { Sleep } from '../../shared/sleep';
import { LlmProviderError } from '../domain/llm-provider.error';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

export interface RetryDependencies {
  sleep: Sleep;
  random: () => number;
  logger: Logger;
  label: string;
}

// Repete só falhas temporárias do provedor, com backoff exponencial e jitter de até 50%
export const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  deps: RetryDependencies,
): Promise<T> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error instanceof LlmProviderError && error.retryable;
      if (!retryable || attempt >= options.maxAttempts) throw error;

      const exponential = options.baseDelayMs * 2 ** (attempt - 1);
      const delay = Math.round(exponential + exponential * 0.5 * deps.random());
      deps.logger.warn(
        `Retrying ${deps.label} (attempt ${attempt + 1}/${options.maxAttempts}) in ${delay}ms: ${error.message}`,
      );
      await deps.sleep(delay);
    }
  }
};
