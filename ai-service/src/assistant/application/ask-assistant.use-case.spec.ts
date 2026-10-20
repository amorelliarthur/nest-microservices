import { z } from 'zod';
import type { ToolCall } from '../../llm/domain/llm-provider.port';
import { FakeLlmProvider } from '../../llm/testing/fake-llm.provider';
import type { FakeReply } from '../../llm/testing/fake-llm.provider';
import { AgentLoopLimitError } from '../domain/agent-loop-limit.error';
import { AskAssistantUseCase, MAX_ITERATIONS } from './ask-assistant.use-case';
import { defineTool } from './tools/tool';
import { ToolRegistry } from './tools/tool-registry';

// Tool simples: o teste do loop não deve depender das regras financeiras
const getValueTool = defineTool({
  name: 'get_value',
  description: 'Returns a value for a key',
  schema: z.object({ key: z.string() }),
  execute: ({ key }, { userId }) =>
    Promise.resolve({ value: `${key}-${userId}` }),
});

const toolCall = (
  name: string,
  args: Record<string, unknown>,
  id = 'call-1',
): ToolCall => ({
  id,
  name,
  arguments: args,
  providerData: { thoughtSignature: 'sig-1' },
});

const makeSut = (replies: FakeReply[]) => {
  const llm = new FakeLlmProvider(replies);
  const useCase = new AskAssistantUseCase(
    llm,
    new ToolRegistry([getValueTool]),
    () => new Date('2026-10-20T12:00:00Z'),
  );
  return { llm, useCase };
};

describe('AskAssistantUseCase', () => {
  it('returns the answer directly when no tool is requested', async () => {
    const { llm, useCase } = makeSut(['Olá! Como posso ajudar?']);

    await expect(useCase.execute('Oi', 'user-1')).resolves.toEqual({
      answer: 'Olá! Como posso ajudar?',
      toolsUsed: [],
    });

    const [request] = llm.requests;
    expect(request.tools?.map((t) => t.name)).toEqual(['get_value']);
    expect(request.system).toContain('2026-10-20');
  });

  it('runs the requested tools with the authenticated user and sends the results back', async () => {
    const call = toolCall('get_value', { key: 'a' });
    const { llm, useCase } = makeSut([
      { text: 'Vou verificar.', toolCalls: [call] },
      'O valor é a-user-1.',
    ]);

    await expect(useCase.execute('Qual o valor?', 'user-1')).resolves.toEqual({
      answer: 'O valor é a-user-1.',
      toolsUsed: ['get_value'],
    });

    expect(llm.requests[1].messages).toEqual([
      { role: 'user', content: 'Qual o valor?' },
      { role: 'assistant', content: 'Vou verificar.', toolCalls: [call] },
      {
        role: 'tool',
        toolCallId: 'call-1',
        toolName: 'get_value',
        content: '{"value":"a-user-1"}',
        isError: false,
      },
    ]);
  });

  it('sends tool failures back to the model flagged as errors', async () => {
    const { llm, useCase } = makeSut([
      { toolCalls: [toolCall('delete_everything', {})] },
      'Não consigo fazer isso.',
    ]);

    await useCase.execute('Apague tudo', 'user-1');

    expect(llm.requests[1].messages[2]).toEqual({
      role: 'tool',
      toolCallId: 'call-1',
      toolName: 'delete_everything',
      content: 'Unknown tool: delete_everything',
      isError: true,
    });
  });

  it('answers every tool call when the model requests several at once', async () => {
    const { llm, useCase } = makeSut([
      {
        toolCalls: [
          toolCall('get_value', { key: 'a' }, 'call-1'),
          toolCall('get_value', { key: 'b' }, 'call-2'),
        ],
      },
      'Pronto.',
    ]);

    await useCase.execute('Valores a e b?', 'user-1');

    const toolMessages = llm.requests[1].messages.filter(
      (m) => m.role === 'tool',
    );
    expect(toolMessages).toEqual([
      expect.objectContaining({
        toolCallId: 'call-1',
        content: '{"value":"a-user-1"}',
      }),
      expect.objectContaining({
        toolCallId: 'call-2',
        content: '{"value":"b-user-1"}',
      }),
    ]);
  });

  it('stops after the iteration limit', async () => {
    const endless = Array.from({ length: MAX_ITERATIONS + 1 }, () => ({
      toolCalls: [toolCall('get_value', { key: 'a' })],
    }));
    const { llm, useCase } = makeSut(endless);

    await expect(useCase.execute('Loop', 'user-1')).rejects.toThrow(
      AgentLoopLimitError,
    );
    expect(llm.requests).toHaveLength(MAX_ITERATIONS);
  });
});
