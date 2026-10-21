import { Logger } from '@nestjs/common';
import { LlmProviderError } from '../domain/llm-provider.error';
import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';
import type { Sleep } from '../../shared/sleep';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
}

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

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.inner.generate(request);
      } catch (error) {
        // Só repete falhas temporárias; erros permanentes e bugs sobem na hora
        const retryable = error instanceof LlmProviderError && error.retryable;
        if (!retryable || attempt >= this.options.maxAttempts) throw error;

        const delay = this.delayFor(attempt);
        this.logger.warn(
          `Retrying LLM call (attempt ${attempt + 1}/${this.options.maxAttempts}) in ${delay}ms: ${error.message}`,
        );
        await this.sleep(delay);
      }
    }
  }

  // Exponencial (base, 2x, 4x...) + jitter de até 50% para espalhar as novas tentativas
  private delayFor(attempt: number): number {
    const exponential = this.options.baseDelayMs * 2 ** (attempt - 1);
    return Math.round(exponential + exponential * 0.5 * this.random());
  }
}
