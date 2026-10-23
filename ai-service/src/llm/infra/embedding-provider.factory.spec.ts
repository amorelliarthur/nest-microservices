import { ConfigService } from '@nestjs/config';
import { createEmbeddingProvider } from './embedding-provider.factory';

const config = (env: Record<string, string>) =>
  new ConfigService({
    GEMINI_API_KEY: 'test-key',
    GEMINI_EMBEDDING_MODEL: 'embed-model',
    ...env,
  });

describe('createEmbeddingProvider', () => {
  it('builds the provider with the configured model and dimensions', () => {
    const provider = createEmbeddingProvider(
      config({ EMBEDDING_DIMENSIONS: '768' }),
    );

    expect(provider.model).toBe('embed-model');
    expect(provider.dimensions).toBe(768);
  });

  it('uses 768 dimensions by default', () => {
    expect(createEmbeddingProvider(config({})).dimensions).toBe(768);
  });

  it.each(['abc', '0', '3072'])(
    'fails fast at startup when EMBEDDING_DIMENSIONS is %s',
    (value) => {
      expect(() =>
        createEmbeddingProvider(config({ EMBEDDING_DIMENSIONS: value })),
      ).toThrow('EMBEDDING_DIMENSIONS');
    },
  );
});
