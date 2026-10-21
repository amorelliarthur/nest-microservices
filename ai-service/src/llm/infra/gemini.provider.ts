import type { GenerateContentResponse, GoogleGenAI } from '@google/genai';
import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';
import { toLlmProviderError } from './gemini.errors';
import {
  fromGeminiResponse,
  toGeminiContents,
  toGeminiTools,
} from './gemini.mapper';

export class GeminiProvider implements LlmProvider {
  readonly name: string;

  constructor(
    private readonly client: GoogleGenAI,
    private readonly model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    let response: GenerateContentResponse;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: toGeminiContents(request.messages),
        config: {
          systemInstruction: request.system,
          maxOutputTokens: request.maxTokens ?? 1024,
          ...(request.tools?.length
            ? { tools: toGeminiTools(request.tools) }
            : {}),
        },
      });
    } catch (error) {
      throw toLlmProviderError(error);
    }

    const { text, toolCalls } = fromGeminiResponse(response);

    return {
      text,
      toolCalls,
      model: this.model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
