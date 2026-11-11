import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import type { FakeLlmProvider } from '../src/llm/testing/fake-llm.provider';
import { createTestApp } from './support/create-test-app';

describe('POST /transactions/classify (e2e)', () => {
  let app: INestApplication<App>;
  let llm: FakeLlmProvider;

  let authHeaders: (userId: string) => Record<string, string>;

  const createApp = async (replies: string[]) => {
    ({ app, llm, authHeaders } = await createTestApp({ llmReplies: replies }));
  };

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with the classification', async () => {
    await createApp(['{"category":"transporte","confidence":0.92}']);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .set(authHeaders('user-1'))
      .send({ description: 'Uber para o aeroporto' })
      .expect(200)
      .expect({ category: 'transporte', confidence: 0.92, needsReview: false });
  });

  it('returns 400 and does not call the model when the description is invalid', async () => {
    await createApp([]);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .set(authHeaders('user-1'))
      .send({ description: 'a' })
      .expect(400);

    expect(llm.requests).toHaveLength(0);
  });

  it('returns 502 without leaking details when the model keeps returning invalid output', async () => {
    await createApp(['{}', '{}']);

    const response = await request(app.getHttpServer())
      .post('/transactions/classify')
      .set(authHeaders('user-1'))
      .send({ description: 'Uber' })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'The AI model returned an invalid response. Please try again.',
    });
  });

  it('returns 401 when the request has no user context', async () => {
    await createApp(['{"category":"transporte","confidence":0.92}']);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .send({ description: 'Uber para o aeroporto' })
      .expect(401);

    expect(llm.requests).toHaveLength(0);
  });

  it('returns 401 when only x-user-* headers are sent, without the internal token', async () => {
    await createApp(['{"category":"transporte","confidence":0.92}']);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'ADMIN' })
      .send({ description: 'Uber para o aeroporto' })
      .expect(401);

    expect(llm.requests).toHaveLength(0);
  });
});
