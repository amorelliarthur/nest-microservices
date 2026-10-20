import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { FINANCIAL_CLIENT } from '../../src/financial/domain/financial-client.port';
import type { FinancialClient } from '../../src/financial/domain/financial-client.port';
import { FakeFinancialClient } from '../../src/financial/testing/fake-financial.client';
import { LLM_PROVIDER } from '../../src/llm/domain/llm-provider.port';
import { FakeLlmProvider } from '../../src/llm/testing/fake-llm.provider';
import type { FakeReply } from '../../src/llm/testing/fake-llm.provider';

export interface TestAppOptions {
  llmReplies?: FakeReply[];
  financial?: FinancialClient;
}

// Único lugar que monta a app de teste: TODA dependência externa é trocada por fake aqui
export const createTestApp = async ({
  llmReplies = [],
  financial = new FakeFinancialClient({}),
}: TestAppOptions = {}) => {
  const llm = new FakeLlmProvider(llmReplies);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(llm)
    .overrideProvider(FINANCIAL_CLIENT)
    .useValue(financial)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  await app.init();
  return { app, llm };
};
