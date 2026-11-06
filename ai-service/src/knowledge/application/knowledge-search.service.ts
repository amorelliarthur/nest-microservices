import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from '../../llm/domain/embedding-provider.port';
import type { EmbeddingProvider } from '../../llm/domain/embedding-provider.port';
import { KNOWLEDGE_REPOSITORY } from '../domain/knowledge-repository.port';
import type {
  KnowledgeRepository,
  KnowledgeSearchResult,
} from '../domain/knowledge-repository.port';
import type { KnowledgeCategory } from '../domain/knowledge.types';
import { KNOWLEDGE_SEARCH_SETTINGS } from './knowledge-search.settings';
import type { KnowledgeSearchSettings } from './knowledge-search.settings';

@Injectable()
export class KnowledgeSearchService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddings: EmbeddingProvider,
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repository: KnowledgeRepository,
    @Inject(KNOWLEDGE_SEARCH_SETTINGS)
    private readonly settings: KnowledgeSearchSettings,
  ) {}

  async search(
    query: string,
    category?: KnowledgeCategory,
  ): Promise<KnowledgeSearchResult[]> {
    const [embedding] = await this.embeddings.embed([query], 'query');
    return this.repository.searchSimilar(embedding, {
      limit: this.settings.limit,
      maxDistance: this.settings.maxDistance,
      embeddingModel: this.embeddings.model,
      category,
    });
  }
}
