import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';

export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake';
  readonly requests: GenerateRequest[] = [];

  constructor(private readonly replies: string[]) {}

  generate(request: GenerateRequest): Promise<GenerateResult> {
    this.requests.push(request);
    const text = this.replies.shift() ?? '';
    return Promise.resolve({
      text,
      model: 'fake',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}
