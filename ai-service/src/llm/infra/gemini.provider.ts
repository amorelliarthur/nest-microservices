import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type {
  GenerateRequest,
  GenerateResult,
  LlmProvider,
} from '../domain/llm-provider.port';

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
    const response = await this.client.models.generateContent({
      model: this.model,
      // Gemini calls the assistant role "model"
      contents: request.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      config: {
        systemInstruction: request.system,
        maxOutputTokens: request.maxTokens ?? 1024,
      },
    });

    return {
      text: response.text ?? '',
      toolCalls: [],
      model: this.model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
