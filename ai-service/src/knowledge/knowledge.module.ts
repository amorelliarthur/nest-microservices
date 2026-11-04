import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type { Pool } from 'pg';
import { LlmModule } from '../llm/llm.module';
import { IngestionService } from './application/ingestion.service';
import { KNOWLEDGE_REPOSITORY } from './domain/knowledge-repository.port';
import { PG_POOL, pgPoolProvider } from './infra/pg-pool.provider';
import { PgKnowledgeRepository } from './infra/pg-knowledge.repository';

@Module({
  imports: [LlmModule],
  providers: [
    pgPoolProvider,
    {
      provide: KNOWLEDGE_REPOSITORY,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => new PgKnowledgeRepository(pool),
    },
    IngestionService,
  ],
  exports: [KNOWLEDGE_REPOSITORY, IngestionService],
})
export class KnowledgeModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Sem fechar o pool, o processo do comando ficaria esperando conexões abertas
  async onModuleDestroy() {
    await this.pool.end();
  }
}
