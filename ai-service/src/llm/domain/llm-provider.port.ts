export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateRequest {
  system?: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LlmProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
