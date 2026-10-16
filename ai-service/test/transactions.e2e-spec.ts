import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER } from '../src/llm/domain/llm-provider.port';
import { FakeLlmProvider } from '../src/llm/testing/fake-llm.provider';

describe('POST /transactions/classify (e2e)', () => {
  let app: INestApplication<App>;
  let llm: FakeLlmProvider;

  const createApp = async (replies: string[]) => {
    llm = new FakeLlmProvider(replies);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(llm)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with the classification', async () => {
    await createApp(['{"category":"transporte","confidence":0.92}']);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .send({ description: 'Uber para o aeroporto' })
      .expect(200)
      .expect({ category: 'transporte', confidence: 0.92, needsReview: false });
  });

  it('returns 400 and does not call the model when the description is invalid', async () => {
    await createApp([]);

    await request(app.getHttpServer())
      .post('/transactions/classify')
      .send({ description: 'a' })
      .expect(400);

    expect(llm.requests).toHaveLength(0);
  });

  it('returns 502 without leaking details when the model keeps returning invalid output', async () => {
    await createApp(['{}', '{}']);

    const response = await request(app.getHttpServer())
      .post('/transactions/classify')
      .send({ description: 'Uber' })
      .expect(502);

    expect(response.body).toEqual({
      statusCode: 502,
      message: 'The AI model returned an invalid response. Please try again.',
    });
  });
});
