import type { KnowledgeChunk } from './knowledge.types';

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

export interface KnowledgeRepository {
  listFingerprints(): Promise<StoredChunkFingerprint[]>;
  upsertChunks(chunks: ChunkToStore[]): Promise<void>;
  deleteChunks(keys: ChunkKey[]): Promise<void>;
  // Dimensões da coluna embedding no banco: a fonte da verdade é o schema
  getEmbeddingDimensions(): Promise<number>;
}

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');
