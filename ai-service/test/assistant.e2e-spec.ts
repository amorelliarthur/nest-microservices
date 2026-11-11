import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MAX_ITERATIONS } from '../src/assistant/application/ask-assistant.use-case';
import { FakeFinancialClient } from '../src/financial/testing/fake-financial.client';
import { FakeKnowledgeRepository } from '../src/knowledge/testing/fake-knowledge.repository';
import { LlmProviderError } from '../src/llm/domain/llm-provider.error';
import type { FakeLlmProvider } from '../src/llm/testing/fake-llm.provider';
import type { FakeReply } from '../src/llm/testing/fake-llm.provider';
import { createTestApp } from './support/create-test-app';

const financial = new FakeFinancialClient({
  'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 1500.5 }],
  'user-2': [{ id: 'acc-2', type: 'CHECKING', balance: 99 }],
});

describe('POST /assistant/ask (e2e)', () => {
  let app: INestApplication<App>;
  let llm: FakeLlmProvider;
  let authHeaders: (userId: string) => Record<string, string>;

  const createApp = async (llmReplies: FakeReply[]) => {
    ({ app, llm, authHeaders } = await createTestApp({
      llmReplies,
      financial,
    }));
  };

  afterEach(async () => {
    await app?.close();
  });

  it('answers using the data of the authenticated user', async () => {
    await createApp([
      { toolCalls: [{ id: 'call-1', name: 'list_accounts', arguments: {} }] },
      'Você tem uma conta corrente com saldo de R$ 1.500,50.',
    ]);

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(200)
      .expect({
        answer: 'Você tem uma conta corrente com saldo de R$ 1.500,50.',
        sources: [],
        toolsUsed: ['list_accounts'],
      });

    expect(llm.requests[1].messages[2]).toMatchObject({
      role: 'tool',
      content: '[{"id":"acc-1","type":"CHECKING","balance":1500.5}]',
    });
  });

  it('forwards the internal token it received when calling the financial service', async () => {
    const financialSpy = new FakeFinancialClient({
      'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 10 }],
    });
    ({ app, authHeaders } = await createTestApp({
      llmReplies: [
        { toolCalls: [{ id: 'call-1', name: 'list_accounts', arguments: {} }] },
        'Você tem uma conta.',
      ],
      financial: financialSpy,
    }));
    const headers = authHeaders('user-1');

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(headers)
      .send({ question: 'Quais são minhas contas?' })
      .expect(200);

    expect(financialSpy.callers).toEqual([
      { userId: 'user-1', internalToken: headers['x-internal-token'] },
    ]);
  });

  it('never exposes accounts of another user, even if the model asks for them', async () => {
    await createApp([
      {
        toolCalls: [
          {
            id: 'call-1',
            name: 'get_balance',
            arguments: { accountId: 'acc-1' },
          },
        ],
      },
      'Não encontrei essa conta.',
    ]);

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-2'))
      .send({ question: 'Qual o saldo da conta acc-1?' })
      .expect(200);

    expect(llm.requests[1].messages[2]).toMatchObject({
      role: 'tool',
      content: 'Account not found',
      isError: true,
    });
  });

  it('returns 400 and does not call the model when the question is invalid', async () => {
    await createApp([]);

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'x'.repeat(501) })
      .expect(400);

    expect(llm.requests).toHaveLength(0);
  });

  it('returns 401 without user context', async () => {
    await createApp([]);

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .send({ question: 'Quais são minhas contas?' })
      .expect(401);
  });

  it('returns 401 when only x-user-* headers are sent, without the internal token', async () => {
    await createApp([]);

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'ADMIN' })
      .send({ question: 'Quais são minhas contas?' })
      .expect(401);

    expect(llm.requests).toHaveLength(0);
  });

  it('returns 502 when the assistant does not finish within the iteration limit', async () => {
    await createApp(
      Array.from({ length: MAX_ITERATIONS }, () => ({
        toolCalls: [{ id: 'call-1', name: 'list_accounts', arguments: {} }],
      })),
    );

    const response = await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'The assistant could not complete the answer. Please try again.',
    });
  });

  it('returns 503 when the AI provider is temporarily unavailable', async () => {
    await createApp([new LlmProviderError('overloaded', true, 503)]);

    const response = await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(503);

    expect(response.body).toEqual({
      statusCode: 503,
      message:
        'The AI service is temporarily unavailable. Please try again shortly.',
    });
  });

  it('returns 502 when the AI provider fails permanently', async () => {
    await createApp([new LlmProviderError('invalid model', false, 404)]);

    const response = await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'The AI service could not process the request.',
    });
  });

  it('answers questions about the product with the knowledge base', async () => {
    const knowledge = new FakeKnowledgeRepository();
    knowledge.searchResults = [
      {
        documentId: 'produto-transacoes',
        documentTitle: 'Transações',
        section: 'Transferência para a mesma conta',
        category: 'produto',
        content: 'Não é possível transferir para a mesma conta.',
        distance: 0.229,
      },
    ];
    ({ app, llm, authHeaders } = await createTestApp({
      llmReplies: [
        {
          toolCalls: [
            {
              id: 'call-1',
              name: 'search_knowledge',
              arguments: {
                query: 'transferir para a mesma conta',
                category: 'produto',
              },
            },
          ],
        },
        'Não, transferências para a mesma conta são recusadas [produto-transacoes#transferencia-para-a-mesma-conta].',
      ],
      financial,
      knowledge,
    }));

    await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(authHeaders('user-1'))
      .send({ question: 'Posso transferir para a mesma conta?' })
      .expect(200)
      .expect({
        answer: 'Não, transferências para a mesma conta são recusadas [1].',
        sources: [
          {
            id: 1,
            document: 'Transações',
            section: 'Transferência para a mesma conta',
          },
        ],
        toolsUsed: ['search_knowledge'],
      });

    expect(llm.requests[1].messages[2]).toMatchObject({
      role: 'tool',
      toolName: 'search_knowledge',
    });
    expect(JSON.stringify(llm.requests[1].messages[2])).toContain(
      'Transferência para a mesma conta',
    );
  });
});
