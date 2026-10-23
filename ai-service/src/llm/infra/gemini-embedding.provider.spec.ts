import { ApiError } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { LlmProviderError } from '../domain/llm-provider.error';
import { GeminiEmbeddingProvider } from './gemini-embedding.provider';

const makeSut = (embedContent: jest.Mock) => {
  const client = { models: { embedContent } } as unknown as GoogleGenAI;
  return new GeminiEmbeddingProvider(client, 'embed-model', 3);
};

describe('GeminiEmbeddingProvider', () => {
  it('exposes the model and the dimensions', () => {
    const provider = makeSut(jest.fn());

    expect(provider.model).toBe('embed-model');
    expect(provider.dimensions).toBe(3);
  });

  it('embeds documents with the document task type and the configured dimensions', async () => {
    const embedContent = jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3] }, { values: [4, 5, 6] }],
    });

    await expect(
      makeSut(embedContent).embed(['a', 'b'], 'document'),
    ).resolves.toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(embedContent).toHaveBeenCalledWith({
      model: 'embed-model',
      contents: ['a', 'b'],
      config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: 3 },
    });
  });

  it('uses the query task type for questions', async () => {
    const embedContent = jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3] }],
    });

    await makeSut(embedContent).embed(['pergunta'], 'query');

    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: { taskType: 'RETRIEVAL_QUERY', outputDimensionality: 3 },
      }),
    );
  });

  it('returns no vectors for no texts, without calling the API', async () => {
    const embedContent = jest.fn();

    await expect(makeSut(embedContent).embed([], 'document')).resolves.toEqual(
      [],
    );
    expect(embedContent).not.toHaveBeenCalled();
  });

  it('rejects a response with a different number of vectors as a permanent error', async () => {
    const embedContent = jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3] }],
    });

    await expect(
      makeSut(embedContent).embed(['a', 'b'], 'document'),
    ).rejects.toMatchObject({ retryable: false });
  });

  it('rejects vectors with unexpected dimensions as a permanent error', async () => {
    const embedContent = jest.fn().mockResolvedValue({
      embeddings: [{ values: [1, 2, 3, 4] }],
    });

    const promise = makeSut(embedContent).embed(['a'], 'document');

    await expect(promise).rejects.toBeInstanceOf(LlmProviderError);
    await expect(promise).rejects.toMatchObject({ retryable: false });
  });

  it('converts API errors with the provider error classification', async () => {
    const embedContent = jest
      .fn()
      .mockRejectedValue(new ApiError({ message: 'overloaded', status: 503 }));

    await expect(
      makeSut(embedContent).embed(['a'], 'query'),
    ).rejects.toMatchObject({ retryable: true, status: 503 });
  });
});
