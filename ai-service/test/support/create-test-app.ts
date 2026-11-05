import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { FINANCIAL_CLIENT } from '../../src/financial/domain/financial-client.port';
import type { FinancialClient } from '../../src/financial/domain/financial-client.port';
import { FakeFinancialClient } from '../../src/financial/testing/fake-financial.client';
import { KNOWLEDGE_REPOSITORY } from '../../src/knowledge/domain/knowledge-repository.port';
import { PG_POOL } from '../../src/knowledge/infra/pg-pool.provider';
import { FakeKnowledgeRepository } from '../../src/knowledge/testing/fake-knowledge.repository';
import { EMBEDDING_PROVIDER } from '../../src/llm/domain/embedding-provider.port';
import { LLM_PROVIDER } from '../../src/llm/domain/llm-provider.port';
import { FakeEmbeddingProvider } from '../../src/llm/testing/fake-embedding.provider';
import { FakeLlmProvider } from '../../src/llm/testing/fake-llm.provider';
import type { FakeReply } from '../../src/llm/testing/fake-llm.provider';

export interface TestAppOptions {
  llmReplies?: FakeReply[];
  financial?: FinancialClient;
  embeddings?: FakeEmbeddingProvider;
  knowledge?: FakeKnowledgeRepository;
}

// Único lugar que monta a app de teste: TODA dependência externa é trocada por fake aqui
export const createTestApp = async ({
  llmReplies = [],
  financial = new FakeFinancialClient({}),
  embeddings = new FakeEmbeddingProvider(),
  knowledge = new FakeKnowledgeRepository(),
}: TestAppOptions = {}) => {
  const llm = new FakeLlmProvider(llmReplies);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(llm)
    .overrideProvider(FINANCIAL_CLIENT)
    .useValue(financial)
    .overrideProvider(EMBEDDING_PROVIDER)
    .useValue(embeddings)
    // Sem o override do pool, o CI tentaria conectar com um DATABASE_URL que não existe
    .overrideProvider(PG_POOL)
    .useValue({ end: () => Promise.resolve() })
    .overrideProvider(KNOWLEDGE_REPOSITORY)
    .useValue(knowledge)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  await app.init();
  return { app, llm };
};
