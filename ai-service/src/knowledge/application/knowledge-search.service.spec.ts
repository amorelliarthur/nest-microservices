import { FakeEmbeddingProvider } from '../../llm/testing/fake-embedding.provider';
import { FakeKnowledgeRepository } from '../testing/fake-knowledge.repository';
import { KnowledgeSearchService } from './knowledge-search.service';

const result = (
  section: string,
  category: 'produto' | 'educacao' = 'produto',
) => ({
  documentId: 'produto-transacoes',
  documentTitle: 'Transações',
  section,
  category,
  content: `Conteúdo de ${section}.`,
  distance: 0.2,
});

const makeSut = () => {
  const embeddings = new FakeEmbeddingProvider(
    [[[0.1, 0.2, 0.3]]],
    'model-a',
    3,
  );
  const repository = new FakeKnowledgeRepository();
  const service = new KnowledgeSearchService(embeddings, repository, {
    limit: 4,
    maxDistance: 0.35,
  });
  return { embeddings, repository, service };
};

describe('KnowledgeSearchService', () => {
  it('embeds the question as a query and searches with the configured settings', async () => {
    const { embeddings, repository, service } = makeSut();

    await service.search('Posso transferir para a mesma conta?');

    expect(embeddings.calls).toEqual([
      { texts: ['Posso transferir para a mesma conta?'], purpose: 'query' },
    ]);
    expect(repository.searchCalls).toEqual([
      {
        embedding: [0.1, 0.2, 0.3],
        options: {
          limit: 4,
          maxDistance: 0.35,
          embeddingModel: 'model-a',
          category: undefined,
        },
      },
    ]);
  });

  it('passes the category filter to the repository', async () => {
    const { repository, service } = makeSut();

    await service.search('Como funciona a regra 50/30/20?', 'educacao');

    expect(repository.searchCalls[0].options.category).toBe('educacao');
  });

  it('returns the results found by the repository', async () => {
    const { repository, service } = makeSut();
    repository.searchResults = [result('Saldo insuficiente')];

    await expect(service.search('E se não tiver saldo?')).resolves.toEqual([
      result('Saldo insuficiente'),
    ]);
  });
});
