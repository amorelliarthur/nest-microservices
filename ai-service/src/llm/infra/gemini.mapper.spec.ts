import type { LlmMessage } from '../domain/llm-provider.port';
import {
  fromGeminiResponse,
  toGeminiContents,
  toGeminiTools,
} from './gemini.mapper';

describe('gemini mapper', () => {
  it('maps user and assistant text messages', () => {
    const messages: LlmMessage[] = [
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Olá!' },
    ];

    expect(toGeminiContents(messages)).toEqual([
      { role: 'user', parts: [{ text: 'Oi' }] },
      { role: 'model', parts: [{ text: 'Olá!' }] },
    ]);
  });

  it('maps assistant tool calls echoing the provider data', () => {
    const messages: LlmMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call-1',
            name: 'list_accounts',
            arguments: {},
            providerData: { thoughtSignature: 'sig-1' },
          },
        ],
      },
    ];

    expect(toGeminiContents(messages)).toEqual([
      {
        role: 'model',
        parts: [
          {
            functionCall: { id: 'call-1', name: 'list_accounts', args: {} },
            thoughtSignature: 'sig-1',
          },
        ],
      },
    ]);
  });

  it('maps tool results to function responses', () => {
    const messages: LlmMessage[] = [
      {
        role: 'tool',
        toolCallId: 'call-1',
        toolName: 'list_accounts',
        content: '[{"id":"acc-1"}]',
      },
    ];

    expect(toGeminiContents(messages)).toEqual([
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call-1',
              name: 'list_accounts',
              response: { output: '[{"id":"acc-1"}]' },
            },
          },
        ],
      },
    ]);
  });

  it('maps tool definitions to function declarations', () => {
    const parameters = { type: 'object', properties: {} };

    expect(
      toGeminiTools([
        { name: 'list_accounts', description: 'Lista as contas', parameters },
      ]),
    ).toEqual([
      {
        functionDeclarations: [
          {
            name: 'list_accounts',
            description: 'Lista as contas',
            parametersJsonSchema: parameters,
          },
        ],
      },
    ]);
  });

  it('extracts text and tool calls from the response, ignoring thoughts', () => {
    const result = fromGeminiResponse({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              { text: 'pensando...', thought: true },
              { text: 'Vou verificar.' },
              {
                functionCall: { id: 'call-1', name: 'list_accounts', args: {} },
                thoughtSignature: 'sig-1',
              },
            ],
          },
        },
      ],
    });

    expect(result).toEqual({
      text: 'Vou verificar.',
      toolCalls: [
        {
          id: 'call-1',
          name: 'list_accounts',
          arguments: {},
          providerData: { thoughtSignature: 'sig-1' },
        },
      ],
    });
  });

  it('generates an id when the model does not provide one', () => {
    const result = fromGeminiResponse({
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ functionCall: { name: 'list_accounts', args: {} } }],
          },
        },
      ],
    });

    expect(result.toolCalls[0].id).toEqual(expect.any(String));
    expect(result.toolCalls[0].id).not.toBe('');
  });
});
