import type { Pool } from 'pg';
import type {
  ChunkKey,
  ChunkToStore,
  KnowledgeRepository,
  StoredChunkFingerprint,
} from '../domain/knowledge-repository.port';

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

interface FingerprintRow {
  document_id: string;
  section: string;
  content_hash: string;
  embedding_model: string;
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
}
