// 'document' para trechos que serão buscados; 'query' para a pergunta que faz a busca
export type EmbeddingPurpose = 'document' | 'query';

export interface EmbeddingProvider {
  // Gravados junto de cada vetor: vetores de modelos diferentes não são comparáveis
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
