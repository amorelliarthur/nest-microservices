import { ConfigService } from '@nestjs/config';
import { createLlmProvider } from './llm-provider.factory';

const config = (env: Record<string, string>) =>
  new ConfigService({ GEMINI_API_KEY: 'test-key', ...env });

describe('createLlmProvider', () => {
  it('uses only the primary model when no fallback is configured', () => {
    const provider = createLlmProvider(config({ GEMINI_MODEL: 'model-a' }));

    expect(provider.name).toBe('gemini:model-a');
  });

  it('chains the fallback model after the primary', () => {
    const provider = createLlmProvider(
      config({ GEMINI_MODEL: 'model-a', GEMINI_FALLBACK_MODEL: 'model-b' }),
    );

    expect(provider.name).toBe('gemini:model-a -> gemini:model-b');
  });
});
