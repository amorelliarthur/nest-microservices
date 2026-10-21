import { ApiError } from '@google/genai';
import { LlmProviderError } from '../domain/llm-provider.error';

// Temporários: sobrecarga, limite de requisições e falhas do servidor
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export const toLlmProviderError = (error: unknown): unknown => {
  if (error instanceof ApiError) {
    return new LlmProviderError(
      `Gemini request failed with status ${error.status}: ${error.message}`,
      RETRYABLE_STATUS.has(error.status),
      error.status,
    );
  }

  // Falha de rede (sem resposta do servidor) também é temporária
  if (error instanceof TypeError && error.message === 'fetch failed') {
    return new LlmProviderError(
      `Gemini request failed: ${error.message}`,
      true,
    );
  }

  // Qualquer outro erro é bug: devolve sem converter
  return error;
};
