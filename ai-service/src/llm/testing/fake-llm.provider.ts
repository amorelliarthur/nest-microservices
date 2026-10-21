import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
  ToolCall,
} from '../domain/llm-provider.port';

export type FakeReply =
  string | { text?: string; toolCalls: ToolCall[] } | Error;

export class FakeLlmProvider implements LlmProvider {
  readonly requests: GenerateRequest[] = [];

  constructor(
    private readonly replies: FakeReply[],
    readonly name = 'fake',
  ) {}

  generate(request: GenerateRequest): Promise<GenerateResult> {
    this.requests.push(request);
    const reply = this.replies.shift() ?? '';
    if (reply instanceof Error) {
      return Promise.reject(reply);
    }

    const { text, toolCalls } =
      typeof reply === 'string'
        ? { text: reply, toolCalls: [] }
        : { text: reply.text ?? '', toolCalls: reply.toolCalls };

    return Promise.resolve({
      text,
      toolCalls,
      model: 'fake',
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}
