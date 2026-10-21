// Falha do provedor de LLM; "retryable" indica se tentar de novo pode resolver
export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
