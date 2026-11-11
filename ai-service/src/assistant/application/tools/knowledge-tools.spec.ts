import { LlmProviderError } from '../../../llm/domain/llm-provider.error';
import { FakeEmbeddingProvider } from '../../../llm/testing/fake-embedding.provider';
import { KnowledgeSearchService } from '../../../knowledge/application/knowledge-search.service';
import { FakeKnowledgeRepository } from '../../../knowledge/testing/fake-knowledge.repository';
import { SourceCollector } from '../citations';
import { createKnowledgeTools } from './knowledge-tools';
import { ToolRegistry } from './tool-registry';

const caller = { userId: 'user-1', internalToken: 'internal-token-1' };

const makeSut = (embeddings = new FakeEmbeddingProvider()) => {
  const repository = new FakeKnowledgeRepository();
  const search = new KnowledgeSearchService(embeddings, repository, {
    limit: 4,
    maxDistance: 0.35,
  });
  return {
    repository,
    registry: new ToolRegistry(createKnowledgeTools(search)),
  };
};

const run = (registry: ToolRegistry, args: Record<string, unknown>) =>
  registry.execute(
    { id: 'call-1', name: 'search_knowledge', arguments: args },
    { caller },
  );

describe('search_knowledge tool', () => {
  it('returns the passages found with their source, without the distance', async () => {
    const { repository, registry } = makeSut();
    repository.searchResults = [
      {
        documentId: 'produto-transacoes',
        documentTitle: 'Transações',
        section: 'Transferência para a mesma conta',
        category: 'produto',
        content: 'Não é possível transferir para a mesma conta.',
        distance: 0.229,
      },
    ];

    await expect(
      run(registry, { query: 'transferir para a mesma conta' }),
    ).resolves.toEqual({
      ok: true,
      output: {
        found: true,
        results: [
          {
            sourceId: 'produto-transacoes#transferencia-para-a-mesma-conta',
            document: 'Transações',
            section: 'Transferência para a mesma conta',
            content: 'Não é possível transferir para a mesma conta.',
          },
        ],
      },
    });
  });

  it('registers the returned passages as citable sources', async () => {
    const { repository, registry } = makeSut();
    repository.searchResults = [
      {
        documentId: 'produto-transacoes',
        documentTitle: 'Transações',
        section: 'Saldo insuficiente',
        category: 'produto',
        content: 'O saque é recusado.',
        distance: 0.26,
      },
    ];
    const sources = new SourceCollector();

    await registry.execute(
      {
        id: 'call-1',
        name: 'search_knowledge',
        arguments: { query: 'sem saldo' },
      },
      { caller, sources },
    );

    expect(sources.get('produto-transacoes#saldo-insuficiente')).toEqual({
      sourceId: 'produto-transacoes#saldo-insuficiente',
      document: 'Transações',
      section: 'Saldo insuficiente',
    });
  });

  it('passes the category filter to the search', async () => {
    const { repository, registry } = makeSut();

    await run(registry, { query: 'regra 50/30/20', category: 'educacao' });

    expect(repository.searchCalls[0].options.category).toBe('educacao');
  });

  it('says explicitly when nothing relevant was found', async () => {
    const { registry } = makeSut();

    const result = await run(registry, { query: 'juros do cheque especial' });

    expect(result).toMatchObject({ ok: true, output: { found: false } });
    expect(JSON.stringify(result)).toContain('could not find');
  });

  it('rejects an unknown category', async () => {
    const { registry } = makeSut();

    const result = await run(registry, {
      query: 'regra 50/30/20',
      category: 'outra',
    });

    expect(result.ok).toBe(false);
  });

  it('reports the knowledge base as unavailable when the embedding provider fails', async () => {
    const { registry } = makeSut(
      new FakeEmbeddingProvider([
        new LlmProviderError('overloaded', true, 503),
      ]),
    );

    await expect(run(registry, { query: 'regra 50/30/20' })).resolves.toEqual({
      ok: false,
      error: 'The knowledge base is temporarily unavailable. Try again later.',
    });
  });
});
