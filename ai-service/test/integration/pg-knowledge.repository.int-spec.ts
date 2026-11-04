import { Pool } from 'pg';
import type { ChunkToStore } from '../../src/knowledge/domain/knowledge-repository.port';
import { PgKnowledgeRepository } from '../../src/knowledge/infra/pg-knowledge.repository';

const url = process.env.TEST_DATABASE_URL;
// Os testes apagam a tabela: só rodam num banco cujo nome termina em _test
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error(
    'TEST_DATABASE_URL must point to a database whose name ends with "_test"',
  );
}

const DIMENSIONS = 768;
const vector = (value: number) =>
  Array.from({ length: DIMENSIONS }, () => value);

const chunk = (overrides: Partial<ChunkToStore> = {}): ChunkToStore => ({
  documentId: 'produto-transacoes',
  documentTitle: 'Transações',
  section: 'Saldo insuficiente',
  category: 'produto',
  content: 'O saque é recusado.',
  contentHash: 'hash-1',
  embedding: vector(0.1),
  embeddingModel: 'gemini-embedding-2',
  ...overrides,
});

describe('PgKnowledgeRepository (integration)', () => {
  const pool = new Pool({ connectionString: url });
  const repository = new PgKnowledgeRepository(pool);

  beforeEach(async () => {
    await pool.query('TRUNCATE knowledge_chunks');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('stores chunks and lists their fingerprints without the vectors', async () => {
    await repository.upsertChunks([
      chunk(),
      chunk({ section: 'Valor mínimo', contentHash: 'hash-2' }),
    ]);

    const fingerprints = await repository.listFingerprints();

    expect(fingerprints).toHaveLength(2);
    expect(fingerprints).toContainEqual({
      documentId: 'produto-transacoes',
      section: 'Saldo insuficiente',
      contentHash: 'hash-1',
      embeddingModel: 'gemini-embedding-2',
    });
  });

  it('stores the vector with all its dimensions', async () => {
    await repository.upsertChunks([chunk()]);

    const { rows } = await pool.query<{ dims: number }>(
      'SELECT vector_dims(embedding) AS dims FROM knowledge_chunks',
    );

    expect(rows[0].dims).toBe(DIMENSIONS);
  });

  it('updates an existing section instead of duplicating it', async () => {
    await repository.upsertChunks([chunk()]);
    await repository.upsertChunks([
      chunk({ content: 'Texto novo.', contentHash: 'hash-2' }),
    ]);

    const { rows } = await pool.query<{
      content: string;
      content_hash: string;
    }>('SELECT content, content_hash FROM knowledge_chunks');

    expect(rows).toEqual([{ content: 'Texto novo.', content_hash: 'hash-2' }]);
  });

  it('stores nothing when one chunk of the batch is invalid', async () => {
    await expect(
      repository.upsertChunks([
        chunk(),
        chunk({ section: 'Inválida', embedding: [0.1, 0.2, 0.3] }),
      ]),
    ).rejects.toThrow();

    expect(await repository.listFingerprints()).toEqual([]);
  });

  it('deletes only the given sections', async () => {
    await repository.upsertChunks([
      chunk(),
      chunk({ section: 'Valor mínimo', contentHash: 'hash-2' }),
    ]);

    await repository.deleteChunks([
      { documentId: 'produto-transacoes', section: 'Saldo insuficiente' },
    ]);

    expect((await repository.listFingerprints()).map((f) => f.section)).toEqual(
      ['Valor mínimo'],
    );
  });

  it('accepts empty batches without touching the database', async () => {
    await expect(repository.upsertChunks([])).resolves.toBeUndefined();
    await expect(repository.deleteChunks([])).resolves.toBeUndefined();
  });

  it('reports the dimensions of the embedding column', async () => {
    await expect(repository.getEmbeddingDimensions()).resolves.toBe(DIMENSIONS);
  });
});
