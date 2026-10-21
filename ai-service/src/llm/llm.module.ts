import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { sleep } from '../shared/sleep';
import { RetryingLlmProvider } from './application/retrying-llm.provider';
import { StructuredOutputService } from './application/structured-output.service';
import { LLM_PROVIDER } from './domain/llm-provider.port';
import type { LlmProvider } from './domain/llm-provider.port';
import { GeminiProvider } from './infra/gemini.provider';
import { LlmProviderExceptionFilter } from './presentation/llm-provider-exception.filter';
import { StructuredOutputExceptionFilter } from './presentation/structured-output-exception.filter';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      // O Gemini é envolvido pelo retry; quem usa LLM_PROVIDER não percebe a diferença
      useFactory: (config: ConfigService): LlmProvider =>
        new RetryingLlmProvider(new GeminiProvider(config), sleep),
    },
    StructuredOutputService,
    { provide: APP_FILTER, useClass: StructuredOutputExceptionFilter },
    { provide: APP_FILTER, useClass: LlmProviderExceptionFilter },
  ],
  exports: [LLM_PROVIDER, StructuredOutputService],
})
export class LlmModule {}
