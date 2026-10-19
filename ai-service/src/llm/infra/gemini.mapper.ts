import { randomUUID } from 'node:crypto';
import type {
  Content,
  GenerateContentResponse,
  Part,
  Tool,
} from '@google/genai';
import type {
  LlmMessage,
  ToolCall,
  ToolDefinition,
} from '../domain/llm-provider.port';

export const toGeminiContents = (messages: LlmMessage[]): Content[] =>
  messages.map((message): Content => {
    switch (message.role) {
      case 'user':
        return { role: 'user', parts: [{ text: message.content }] };
      case 'assistant': {
        const textParts: Part[] = message.content
          ? [{ text: message.content }]
          : [];
        // providerData (ex.: thoughtSignature) precisa voltar junto do functionCall
        const callParts: Part[] = (message.toolCalls ?? []).map((call) => ({
          functionCall: { id: call.id, name: call.name, args: call.arguments },
          ...call.providerData,
        }));
        return { role: 'model', parts: [...textParts, ...callParts] };
      }
      case 'tool':
        return {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: message.toolCallId,
                name: message.toolName,
                response: { output: message.content },
              },
            },
          ],
        };
    }
  });

export const toGeminiTools = (tools: ToolDefinition[]): Tool[] => [
  {
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.parameters,
    })),
  },
];

export const fromGeminiResponse = (
  response: Pick<GenerateContentResponse, 'candidates'>,
): { text: string; toolCalls: ToolCall[] } => {
  const parts = response.candidates?.[0]?.content?.parts ?? [];

  const text = parts
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('');

  const toolCalls = parts.flatMap((part): ToolCall[] =>
    part.functionCall
      ? [
          {
            id: part.functionCall.id ?? randomUUID(),
            name: part.functionCall.name ?? '',
            arguments: part.functionCall.args ?? {},
            ...(part.thoughtSignature
              ? { providerData: { thoughtSignature: part.thoughtSignature } }
              : {}),
          },
        ]
      : [],
  );

  return { text, toolCalls };
};
