import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { GenerateContentResponse } from '@google/genai';
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

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.client = new GoogleGenAI({
      apiKey: config.getOrThrow<string>('GEMINI_API_KEY'),
    });
    this.model = config.getOrThrow<string>('GEMINI_MODEL');
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
