import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { LLM_PROVIDER } from '../../src/llm/domain/llm-provider.port';
import { FakeLlmProvider } from '../../src/llm/testing/fake-llm.provider';
import type { FakeReply } from '../../src/llm/testing/fake-llm.provider';

export interface TestAppOptions {
  llmReplies?: FakeReply[];
}

// Único lugar que monta a app de teste: TODA dependência externa é trocada por fake aqui
export const createTestApp = async ({
  llmReplies = [],
}: TestAppOptions = {}) => {
  const llm = new FakeLlmProvider(llmReplies);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(llm)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  await app.init();
  return { app, llm };
};
