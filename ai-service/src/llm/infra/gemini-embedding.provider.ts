import type { EmbedContentResponse, GoogleGenAI } from '@google/genai';
import type {
  EmbeddingProvider,
  EmbeddingPurpose,
} from '../domain/embedding-provider.port';
import { LlmProviderError } from '../domain/llm-provider.error';
import { toLlmProviderError } from './gemini.errors';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly client: GoogleGenAI,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    if (texts.length === 0) return [];

    let response: EmbedContentResponse;
    try {
      response = await this.client.models.embedContent({
        model: this.model,
        contents: texts,
        config: {
          taskType:
            purpose === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
          outputDimensionality: this.dimensions,
        },
      });
    } catch (error) {
      throw toLlmProviderError(error);
    }

    const vectors = (response.embeddings ?? []).map((e) => e.values ?? []);

    // Contrato: um vetor por texto, todos com a dimensão configurada.
    // Diferença aqui é erro de configuração: repetir não resolve.
    if (
      vectors.length !== texts.length ||
      vectors.some((vector) => vector.length !== this.dimensions)
    ) {
      throw new LlmProviderError(
        `Unexpected embedding response: expected ${texts.length} vectors of ${this.dimensions} dimensions`,
        false,
      );
    }
    return vectors;
  }
}
