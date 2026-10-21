import { ApiError } from '@google/genai';
import { LlmProviderError } from '../domain/llm-provider.error';
import { toLlmProviderError } from './gemini.errors';

const apiError = (status: number) =>
  new ApiError({ message: 'google error', status });

describe('toLlmProviderError', () => {
  it.each([429, 500, 502, 503, 504])(
    'marks status %i as retryable',
    (status) => {
      const error = toLlmProviderError(apiError(status));

      expect(error).toBeInstanceOf(LlmProviderError);
      expect(error).toMatchObject({ retryable: true, status });
    },
  );

  it.each([400, 401, 403, 404])(
    'marks status %i as not retryable',
    (status) => {
      expect(toLlmProviderError(apiError(status))).toMatchObject({
        retryable: false,
        status,
      });
    },
  );

  it('marks network failures as retryable', () => {
    const error = toLlmProviderError(new TypeError('fetch failed'));

    expect(error).toBeInstanceOf(LlmProviderError);
    expect(error).toMatchObject({ retryable: true });
  });

  it('returns unknown errors unchanged so bugs are not hidden', () => {
    const bug = new RangeError('boom');

    expect(toLlmProviderError(bug)).toBe(bug);
  });
});
