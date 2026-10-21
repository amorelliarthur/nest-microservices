import { LlmProviderError } from '../domain/llm-provider.error';
import type { GenerateRequest } from '../domain/llm-provider.port';
import { FakeLlmProvider } from '../testing/fake-llm.provider';
import type { FakeReply } from '../testing/fake-llm.provider';
import { FallbackLlmProvider } from './fallback-llm.provider';

const request: GenerateRequest = {
  messages: [{ role: 'user', content: 'Oi' }],
};

const makeSut = (
  primaryReplies: FakeReply[],
  secondaryReplies: FakeReply[],
) => {
  const primary = new FakeLlmProvider(primaryReplies, 'primary');
  const secondary = new FakeLlmProvider(secondaryReplies, 'secondary');
  return {
    primary,
    secondary,
    provider: new FallbackLlmProvider([primary, secondary]),
  };
};

describe('FallbackLlmProvider', () => {
  it('uses the primary provider when it works', async () => {
    const { secondary, provider } = makeSut(
      ['from primary'],
      ['from secondary'],
    );

    await expect(provider.generate(request)).resolves.toMatchObject({
      text: 'from primary',
    });
    expect(secondary.requests).toHaveLength(0);
  });

  it('falls back to the next provider on a temporary failure', async () => {
    const { primary, secondary, provider } = makeSut(
      [new LlmProviderError('overloaded', true, 503)],
      ['from secondary'],
    );

    await expect(provider.generate(request)).resolves.toMatchObject({
      text: 'from secondary',
    });
    expect(primary.requests).toHaveLength(1);
    expect(secondary.requests).toHaveLength(1);
  });

  it('does not fall back on permanent failures, so configuration errors surface', async () => {
    const { secondary, provider } = makeSut(
      [new LlmProviderError('model not found', false, 404)],
      ['from secondary'],
    );

    await expect(provider.generate(request)).rejects.toMatchObject({
      retryable: false,
      status: 404,
    });
    expect(secondary.requests).toHaveLength(0);
  });

  it('does not fall back on unexpected errors', async () => {
    const { secondary, provider } = makeSut(
      [new TypeError('boom')],
      ['from secondary'],
    );

    await expect(provider.generate(request)).rejects.toBeInstanceOf(TypeError);
    expect(secondary.requests).toHaveLength(0);
  });

  it('rethrows the last error when every provider fails', async () => {
    const { primary, secondary, provider } = makeSut(
      [new LlmProviderError('primary overloaded', true, 503)],
      [new LlmProviderError('secondary overloaded', true, 503)],
    );

    await expect(provider.generate(request)).rejects.toThrow(
      'secondary overloaded',
    );
    expect(primary.requests).toHaveLength(1);
    expect(secondary.requests).toHaveLength(1);
  });

  it('describes the chain in its name', () => {
    const { provider } = makeSut([], []);

    expect(provider.name).toBe('primary -> secondary');
  });

  it('requires at least one provider', () => {
    expect(() => new FallbackLlmProvider([])).toThrow();
  });
});
