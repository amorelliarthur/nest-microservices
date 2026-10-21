import { Logger } from '@nestjs/common';
import { LlmProviderError } from '../domain/llm-provider.error';
import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';

export class FallbackLlmProvider implements LlmProvider {
  readonly name: string;
  private readonly logger = new Logger(FallbackLlmProvider.name);

  constructor(private readonly providers: LlmProvider[]) {
    if (providers.length === 0) {
      throw new Error('FallbackLlmProvider requires at least one provider');
    }
    this.name = providers.map((provider) => provider.name).join(' -> ');
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    for (let index = 0; ; index++) {
      const provider = this.providers[index];
      try {
        return await provider.generate(request);
      } catch (error) {
        // Só troca de provider em falha temporária; erro de configuração precisa aparecer
        const retryable = error instanceof LlmProviderError && error.retryable;
        const next = this.providers.at(index + 1);
        if (!retryable || !next) throw error;

        this.logger.warn(
          `${provider.name} unavailable, falling back to ${next.name}: ${error.message}`,
        );
      }
    }
  }
}
