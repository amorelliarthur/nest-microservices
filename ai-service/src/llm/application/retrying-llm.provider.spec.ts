import { LlmProviderError } from '../domain/llm-provider.error';
import type { GenerateRequest } from '../domain/llm-provider.port';
import { FakeLlmProvider } from '../testing/fake-llm.provider';
import type { FakeReply } from '../testing/fake-llm.provider';
import { RetryingLlmProvider } from './retrying-llm.provider';

const overloaded = () => new LlmProviderError('overloaded', true, 503);

const request: GenerateRequest = {
  messages: [{ role: 'user', content: 'Oi' }],
};

const makeSut = (replies: FakeReply[], random = () => 0) => {
  const inner = new FakeLlmProvider(replies);
  const delays: number[] = [];
  const fakeSleep = (ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  };
  const provider = new RetryingLlmProvider(
    inner,
    fakeSleep,
    { maxAttempts: 3, baseDelayMs: 500 },
    random,
  );
  return { inner, delays, provider };
};

describe('RetryingLlmProvider', () => {
  it('returns the first successful response without waiting', async () => {
    const { inner, delays, provider } = makeSut(['ok']);

    await expect(provider.generate(request)).resolves.toMatchObject({
      text: 'ok',
    });
    expect(inner.requests).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('retries temporary failures with exponential backoff', async () => {
    const { inner, delays, provider } = makeSut([
      overloaded(),
      overloaded(),
      'ok',
    ]);

    await expect(provider.generate(request)).resolves.toMatchObject({
      text: 'ok',
    });
    expect(inner.requests).toHaveLength(3);
    expect(delays).toEqual([500, 1000]);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const { inner, delays, provider } = makeSut([
      overloaded(),
      overloaded(),
      overloaded(),
    ]);

    await expect(provider.generate(request)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
    expect(inner.requests).toHaveLength(3);
    expect(delays).toEqual([500, 1000]);
  });

  it('does not retry permanent failures', async () => {
    const { inner, delays, provider } = makeSut([
      new LlmProviderError('invalid model', false, 404),
    ]);

    await expect(provider.generate(request)).rejects.toMatchObject({
      retryable: false,
    });
    expect(inner.requests).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('does not retry unexpected errors, so bugs surface immediately', async () => {
    const { inner, provider } = makeSut([new TypeError('boom')]);

    await expect(provider.generate(request)).rejects.toBeInstanceOf(TypeError);
    expect(inner.requests).toHaveLength(1);
  });

  it('adds up to 50% of jitter to each delay', async () => {
    const { delays, provider } = makeSut([overloaded(), 'ok'], () => 1);

    await provider.generate(request);

    expect(delays).toEqual([750]);
  });
});
