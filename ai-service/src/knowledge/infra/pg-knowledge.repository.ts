import type { Pool } from 'pg';
import type {
  ChunkKey,
  ChunkToStore,
  KnowledgeRepository,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  StoredChunkFingerprint,
} from '../domain/knowledge-repository.port';
import type { KnowledgeCategory } from '../domain/knowledge.types';

// O vetor vai como texto no formato '[0.1,0.2]' (o que JSON.stringify produz) com cast ::vector
const UPSERT_SQL = `
  INSERT INTO knowledge_chunks
    (document_id, document_title, section, category, content, content_hash, embedding, embedding_model)
  VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8)
  ON CONFLICT (document_id, section) DO UPDATE SET
    document_title = EXCLUDED.document_title,
    category = EXCLUDED.category,
    content = EXCLUDED.content,
    content_hash = EXCLUDED.content_hash,
    embedding = EXCLUDED.embedding,
    embedding_model = EXCLUDED.embedding_model,
    updated_at = now()`;

// A busca ordenada por distância com LIMIT usa o índice HNSW;
// o filtro de distância fica por fora para não impedir o uso do índice
const SEARCH_SQL = `
  SELECT * FROM (
    SELECT document_id, document_title, section, category, content,
           embedding <=> $1::vector AS distance
    FROM knowledge_chunks
    WHERE embedding_model = $2
      AND ($3::text IS NULL OR category = $3)
    ORDER BY embedding <=> $1::vector
    LIMIT $4
  ) AS nearest
  WHERE distance <= $5
  ORDER BY distance`;

interface FingerprintRow {
  document_id: string;
  section: string;
  content_hash: string;
  embedding_model: string;
}

interface SearchRow {
  document_id: string;
  document_title: string;
  section: string;
  category: KnowledgeCategory;
  content: string;
  distance: number;
}

export class PgKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly pool: Pool) {}

  async listFingerprints(): Promise<StoredChunkFingerprint[]> {
    const { rows } = await this.pool.query<FingerprintRow>(
      'SELECT document_id, section, content_hash, embedding_model FROM knowledge_chunks',
    );
    return rows.map((row) => ({
      documentId: row.document_id,
      section: row.section,
      contentHash: row.content_hash,
      embeddingModel: row.embedding_model,
    }));
  }

  // Tudo ou nada: uma falha no meio do lote não deixa a base pela metade
  async upsertChunks(chunks: ChunkToStore[]): Promise<void> {
    if (chunks.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const chunk of chunks) {
        await client.query(UPSERT_SQL, [
          chunk.documentId,
          chunk.documentTitle,
          chunk.section,
          chunk.category,
          chunk.content,
          chunk.contentHash,
          JSON.stringify(chunk.embedding),
          chunk.embeddingModel,
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Uma única consulta: o unnest transforma as duas listas em pares (documento, seção)
  async deleteChunks(keys: ChunkKey[]): Promise<void> {
    if (keys.length === 0) return;

    await this.pool.query(
      `DELETE FROM knowledge_chunks
       WHERE (document_id, section) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
      [keys.map((key) => key.documentId), keys.map((key) => key.section)],
    );
  }
  // No pgvector, o atttypmod da coluna vector guarda o número de dimensões
  async getEmbeddingDimensions(): Promise<number> {
    const { rows } = await this.pool.query<{ dimensions: number }>(
      `SELECT atttypmod AS dimensions FROM pg_attribute
       WHERE attrelid = 'knowledge_chunks'::regclass AND attname = 'embedding'`,
    );
    return rows[0].dimensions;
  }

  async searchSimilar(
    embedding: number[],
    options: KnowledgeSearchOptions,
  ): Promise<KnowledgeSearchResult[]> {
    const { rows } = await this.pool.query<SearchRow>(SEARCH_SQL, [
      JSON.stringify(embedding),
      options.embeddingModel,
      options.category ?? null,
      options.limit,
      options.maxDistance,
    ]);
    return rows.map((row) => ({
      documentId: row.document_id,
      documentTitle: row.document_title,
      section: row.section,
      category: row.category,
      content: row.content,
      distance: row.distance,
    }));
  }
}
