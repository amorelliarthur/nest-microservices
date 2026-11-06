import { Logger } from '@nestjs/common';
import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';
import type { Sleep } from '../../shared/sleep';
import { retryWithBackoff } from './retry-with-backoff';
import type { RetryOptions } from './retry-with-backoff';

export class RetryingLlmProvider implements LlmProvider {
  readonly name: string;
  private readonly logger = new Logger(RetryingLlmProvider.name);

  constructor(
    private readonly inner: LlmProvider,
    private readonly sleep: Sleep,
    private readonly options: RetryOptions = {
      maxAttempts: 3,
      baseDelayMs: 500,
    },
    private readonly random: () => number = Math.random,
  ) {
    this.name = inner.name;
  }

  generate(request: GenerateRequest): Promise<GenerateResult> {
    return retryWithBackoff(() => this.inner.generate(request), this.options, {
      sleep: this.sleep,
      random: this.random,
      logger: this.logger,
      label: 'LLM call',
    });
  }
}
