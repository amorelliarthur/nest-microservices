import { LlmProviderError } from '../domain/llm-provider.error';
import { FakeEmbeddingProvider } from '../testing/fake-embedding.provider';
import type { FakeEmbeddingReply } from '../testing/fake-embedding.provider';
import { RetryingEmbeddingProvider } from './retrying-embedding.provider';

const makeSut = (replies: FakeEmbeddingReply[]) => {
  const inner = new FakeEmbeddingProvider(replies, 'embed-model', 3);
  const delays: number[] = [];
  const fakeSleep = (ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  };
  const provider = new RetryingEmbeddingProvider(
    inner,
    fakeSleep,
    { maxAttempts: 3, baseDelayMs: 500 },
    () => 0,
  );
  return { inner, delays, provider };
};

describe('RetryingEmbeddingProvider', () => {
  it('exposes the model and the dimensions of the wrapped provider', () => {
    const { provider } = makeSut([]);

    expect(provider.model).toBe('embed-model');
    expect(provider.dimensions).toBe(3);
  });

  it('retries temporary failures and returns the vectors', async () => {
    const { inner, delays, provider } = makeSut([
      new LlmProviderError('overloaded', true, 503),
      [[1, 2, 3]],
    ]);

    await expect(provider.embed(['a'], 'document')).resolves.toEqual([
      [1, 2, 3],
    ]);
    expect(inner.calls).toHaveLength(2);
    expect(delays).toEqual([500]);
  });

  it('does not retry permanent failures', async () => {
    const { inner, provider } = makeSut([
      new LlmProviderError('wrong dimensions', false),
    ]);

    await expect(provider.embed(['a'], 'document')).rejects.toMatchObject({
      retryable: false,
    });
    expect(inner.calls).toHaveLength(1);
  });
});
