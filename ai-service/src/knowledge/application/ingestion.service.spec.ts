import { LlmProviderError } from '../../llm/domain/llm-provider.error';
import { FakeEmbeddingProvider } from '../../llm/testing/fake-embedding.provider';
import { KnowledgeDocumentError } from '../domain/knowledge-document.error';
import { FakeKnowledgeRepository } from '../testing/fake-knowledge.repository';
import { IngestionService } from './ingestion.service';
import type { KnowledgeSource } from './ingestion.service';

const source = (
  id: string,
  sections: Record<string, string>,
  category = 'produto',
): KnowledgeSource => ({
  name: `${id}.md`,
  content:
    `---\nid: ${id}\ntitle: Título ${id}\ncategory: ${category}\n---\n\n` +
    Object.entries(sections)
      .map(([title, text]) => `## ${title}\n\n${text}`)
      .join('\n\n'),
});

const baseSources = [
  source('doc-a', { 'Seção 1': 'Texto 1.', 'Seção 2': 'Texto 2.' }),
  source('doc-b', { 'Seção 3': 'Texto 3.' }, 'educacao'),
];

const makeSut = (
  embeddings = new FakeEmbeddingProvider([], 'model-a', 3),
  repository = new FakeKnowledgeRepository(),
) => ({
  embeddings,
  repository,
  service: new IngestionService(embeddings, repository),
});

describe('IngestionService', () => {
  it('stores every section on the first ingestion, embedded as documents', async () => {
    const { embeddings, repository, service } = makeSut();

    await expect(service.ingest(baseSources)).resolves.toEqual({
      created: 3,
      updated: 0,
      unchanged: 0,
      deleted: 0,
    });

    expect(repository.chunks.size).toBe(3);
    expect(embeddings.calls).toHaveLength(1);
    expect(embeddings.calls[0].purpose).toBe('document');
    expect(embeddings.calls[0].texts[0]).toBe(
      'Título doc-a > Seção 1\n\nTexto 1.',
    );
    expect([...repository.chunks.values()][0]).toMatchObject({
      documentId: 'doc-a',
      section: 'Seção 1',
      category: 'produto',
      embedding: [0, 0, 0],
      embeddingModel: 'model-a',
    });
  });

  it('does not call the embedding provider when nothing changed', async () => {
    const { embeddings, service } = makeSut();
    await service.ingest(baseSources);

    await expect(service.ingest(baseSources)).resolves.toEqual({
      created: 0,
      updated: 0,
      unchanged: 3,
      deleted: 0,
    });
    expect(embeddings.calls).toHaveLength(1);
  });

  it('re-embeds only the sections that changed', async () => {
    const { embeddings, service } = makeSut();
    await service.ingest(baseSources);

    const report = await service.ingest([
      source('doc-a', {
        'Seção 1': 'Texto 1 revisado.',
        'Seção 2': 'Texto 2.',
      }),
      baseSources[1],
    ]);

    expect(report).toEqual({
      created: 0,
      updated: 1,
      unchanged: 2,
      deleted: 0,
    });
    expect(embeddings.calls[1].texts).toEqual([
      'Título doc-a > Seção 1\n\nTexto 1 revisado.',
    ]);
  });

  it('deletes sections that no longer exist in the documents', async () => {
    const { repository, service } = makeSut();
    await service.ingest(baseSources);

    const report = await service.ingest([
      source('doc-a', { 'Seção 1': 'Texto 1.' }),
      baseSources[1],
    ]);

    expect(report).toEqual({
      created: 0,
      updated: 0,
      unchanged: 2,
      deleted: 1,
    });
    expect([...repository.chunks.values()].map((c) => c.section)).toEqual([
      'Seção 1',
      'Seção 3',
    ]);
  });

  it('re-embeds everything when the embedding model changes', async () => {
    const repository = new FakeKnowledgeRepository();
    await makeSut(
      new FakeEmbeddingProvider([], 'model-a', 3),
      repository,
    ).service.ingest(baseSources);

    const { service } = makeSut(
      new FakeEmbeddingProvider([], 'model-b', 3),
      repository,
    );

    await expect(service.ingest(baseSources)).resolves.toEqual({
      created: 0,
      updated: 3,
      unchanged: 0,
      deleted: 0,
    });
    expect(
      [...repository.chunks.values()].every(
        (c) => c.embeddingModel === 'model-b',
      ),
    ).toBe(true);
  });

  it('embeds in batches of 50 sections', async () => {
    const { embeddings, service } = makeSut();
    const manySections = Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => [`Seção ${i}`, `Texto ${i}.`]),
    );

    await service.ingest([source('doc-grande', manySections)]);

    expect(embeddings.calls.map((call) => call.texts.length)).toEqual([
      50, 50, 20,
    ]);
  });

  it('changes nothing when a document is invalid', async () => {
    const { embeddings, repository, service } = makeSut();

    await expect(
      service.ingest([
        ...baseSources,
        source('doc-c', { Seção: 'Texto.' }, 'invalida'),
      ]),
    ).rejects.toBeInstanceOf(KnowledgeDocumentError);

    expect(embeddings.calls).toHaveLength(0);
    expect(repository.upsertCalls).toBe(0);
    expect(repository.deleteCalls).toBe(0);
  });

  it('changes nothing when the embedding provider fails', async () => {
    const { repository, service } = makeSut(
      new FakeEmbeddingProvider(
        [new LlmProviderError('down', true, 503)],
        'model-a',
        3,
      ),
    );

    await expect(service.ingest(baseSources)).rejects.toBeInstanceOf(
      LlmProviderError,
    );

    expect(repository.upsertCalls).toBe(0);
    expect(repository.deleteCalls).toBe(0);
  });

  it('refuses to ingest when the configured dimensions differ from the database', async () => {
    const { embeddings, repository, service } = makeSut(
      new FakeEmbeddingProvider([], 'model-a', 3),
      new FakeKnowledgeRepository(768),
    );

    await expect(service.ingest(baseSources)).rejects.toThrow(
      'EMBEDDING_DIMENSIONS',
    );

    expect(embeddings.calls).toHaveLength(0);
    expect(repository.upsertCalls).toBe(0);
  });
});
