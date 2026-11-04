import type {
  ChunkKey,
  ChunkToStore,
  KnowledgeRepository,
  StoredChunkFingerprint,
} from '../domain/knowledge-repository.port';

const keyOf = (key: ChunkKey) => `${key.documentId}::${key.section}`;

// Repositório em memória: os testes do serviço verificam a decisão, não o SQL
export class FakeKnowledgeRepository implements KnowledgeRepository {
  readonly chunks = new Map<string, ChunkToStore>();
  upsertCalls = 0;
  deleteCalls = 0;

  constructor(private readonly dimensions = 3) {}

  listFingerprints(): Promise<StoredChunkFingerprint[]> {
    return Promise.resolve(
      [...this.chunks.values()].map((chunk) => ({
        documentId: chunk.documentId,
        section: chunk.section,
        contentHash: chunk.contentHash,
        embeddingModel: chunk.embeddingModel,
      })),
    );
  }

  upsertChunks(chunks: ChunkToStore[]): Promise<void> {
    this.upsertCalls++;
    for (const chunk of chunks) this.chunks.set(keyOf(chunk), chunk);
    return Promise.resolve();
  }

  deleteChunks(keys: ChunkKey[]): Promise<void> {
    this.deleteCalls++;
    for (const key of keys) this.chunks.delete(keyOf(key));
    return Promise.resolve();
  }

  getEmbeddingDimensions(): Promise<number> {
    return Promise.resolve(this.dimensions);
  }
}
