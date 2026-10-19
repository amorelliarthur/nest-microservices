export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema dos argumentos
}

export interface ToolCall {
  id: string;
  name: string;
  // Gerado pelo modelo: NÃO validado. Toda tool precisa validar antes de usar
  arguments: Record<string, unknown>;
  // Dados opacos do provedor que precisam ser reenviados na próxima chamada
  providerData?: Record<string, unknown>;
}

export type LlmMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

export interface GenerateRequest {
  system?: string;
  messages: LlmMessage[];
  tools?: ToolDefinition[];
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  toolCalls: ToolCall[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
