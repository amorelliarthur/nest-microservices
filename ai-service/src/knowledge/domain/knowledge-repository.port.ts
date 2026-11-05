import type { KnowledgeCategory, KnowledgeChunk } from './knowledge.types';

// O que a ingestão precisa saber de cada trecho gravado, sem trazer o vetor
export interface StoredChunkFingerprint {
  documentId: string;
  section: string;
  contentHash: string;
  embeddingModel: string;
}

export type ChunkToStore = Omit<KnowledgeChunk, 'embeddingText'> & {
  embedding: number[];
  embeddingModel: string;
};

export interface ChunkKey {
  documentId: string;
  section: string;
}

export interface KnowledgeSearchOptions {
  limit: number;
  // Distância de cosseno máxima: acima disso o trecho não tem relação com a pergunta
  maxDistance: number;
  // Só compara vetores do mesmo modelo: vetores de modelos diferentes não são comparáveis
  embeddingModel: string;
  category?: KnowledgeCategory;
}

export interface KnowledgeSearchResult {
  documentId: string;
  documentTitle: string;
  section: string;
  category: KnowledgeCategory;
  content: string;
  distance: number;
}

export interface KnowledgeRepository {
  listFingerprints(): Promise<StoredChunkFingerprint[]>;
  upsertChunks(chunks: ChunkToStore[]): Promise<void>;
  deleteChunks(keys: ChunkKey[]): Promise<void>;
  // Dimensões da coluna embedding no banco: a fonte da verdade é o schema
  getEmbeddingDimensions(): Promise<number>;
  searchSimilar(
    embedding: number[],
    options: KnowledgeSearchOptions,
  ): Promise<KnowledgeSearchResult[]>;
}

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');
