import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { MAX_ITERATIONS } from '../src/assistant/application/ask-assistant.use-case';
import { FakeFinancialClient } from '../src/financial/testing/fake-financial.client';
import type { FakeLlmProvider } from '../src/llm/testing/fake-llm.provider';
import type { FakeReply } from '../src/llm/testing/fake-llm.provider';
import { createTestApp } from './support/create-test-app';

const financial = new FakeFinancialClient({
  'user-1': [{ id: 'acc-1', type: 'CHECKING', balance: 1500.5 }],
  'user-2': [{ id: 'acc-2', type: 'CHECKING', balance: 99 }],
});

const userHeaders = (userId: string) => ({
  'x-user-id': userId,
  'x-user-role': 'USER',
});

describe('POST /assistant/ask (e2e)', () => {
  let app: INestApplication<App>;
  let llm: FakeLlmProvider;

  const createApp = async (llmReplies: FakeReply[]) => {
    ({ app, llm } = await createTestApp({ llmReplies, financial }));
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
      .set(userHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(200)
      .expect({
        answer: 'Você tem uma conta corrente com saldo de R$ 1.500,50.',
        toolsUsed: ['list_accounts'],
      });

    expect(llm.requests[1].messages[2]).toMatchObject({
      role: 'tool',
      content: '[{"id":"acc-1","type":"CHECKING","balance":1500.5}]',
    });
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
      .set(userHeaders('user-2'))
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
      .set(userHeaders('user-1'))
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

  it('returns 502 when the assistant does not finish within the iteration limit', async () => {
    await createApp(
      Array.from({ length: MAX_ITERATIONS }, () => ({
        toolCalls: [{ id: 'call-1', name: 'list_accounts', arguments: {} }],
      })),
    );

    const response = await request(app.getHttpServer())
      .post('/assistant/ask')
      .set(userHeaders('user-1'))
      .send({ question: 'Quais são minhas contas?' })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'The assistant could not complete the answer. Please try again.',
    });
  });
});
