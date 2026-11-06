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

describe('PgKnowledgeRepository.searchSimilar (integration)', () => {
  const pool = new Pool({ connectionString: url });
  const repository = new PgKnowledgeRepository(pool);

  // Vetores de laboratório: distâncias de cosseno calculáveis no papel
  const basis = (index: number, weight = 1) => {
    const values = Array.from({ length: DIMENSIONS }, () => 0);
    values[index] = weight;
    return values;
  };
  const add = (a: number[], b: number[]) => a.map((value, i) => value + b[i]);

  const MODEL = 'gemini-embedding-2';
  const query = basis(0);
  const options = { limit: 10, maxDistance: 2, embeddingModel: MODEL };
  const sections = (results: { section: string }[]) =>
    results.map((r) => r.section);

  beforeAll(async () => {
    await pool.query('TRUNCATE knowledge_chunks');
    await repository.upsertChunks([
      chunk({ section: 'A', embedding: basis(0) }), // distância 0
      chunk({ section: 'B', embedding: add(basis(0), basis(1)) }), // 1 - 1/√2 ≈ 0,293
      chunk({
        section: 'C',
        category: 'educacao',
        embedding: add(basis(0), basis(3, 0.1)),
      }), // ≈ 0,005
      chunk({ section: 'D', embedding: basis(2) }), // 1 (perpendicular)
      chunk({
        section: 'E',
        embedding: basis(0),
        embeddingModel: 'other-model',
      }),
    ]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns the nearest chunks first, with their cosine distance', async () => {
    const results = await repository.searchSimilar(query, options);

    expect(sections(results)).toEqual(['A', 'C', 'B', 'D']);
    expect(results[0].distance).toBeCloseTo(0, 5);
    expect(results[2].distance).toBeCloseTo(1 - 1 / Math.SQRT2, 5);
    expect(results[0]).toMatchObject({
      documentId: 'produto-transacoes',
      documentTitle: 'Transações',
      category: 'produto',
      content: 'O saque é recusado.',
    });
  });

  it('filters by category', async () => {
    const results = await repository.searchSimilar(query, {
      ...options,
      category: 'educacao',
    });

    expect(sections(results)).toEqual(['C']);
  });

  it('respects the limit', async () => {
    expect(
      sections(await repository.searchSimilar(query, { ...options, limit: 2 })),
    ).toEqual(['A', 'C']);
  });

  it('drops chunks beyond the maximum distance', async () => {
    expect(
      sections(
        await repository.searchSimilar(query, { ...options, maxDistance: 0.5 }),
      ),
    ).toEqual(['A', 'C', 'B']);
  });

  it('only compares vectors of the requested embedding model', async () => {
    expect(
      sections(
        await repository.searchSimilar(query, {
          ...options,
          embeddingModel: 'other-model',
        }),
      ),
    ).toEqual(['E']);
  });
});
