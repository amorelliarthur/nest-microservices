import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { StructuredOutputService } from './application/structured-output.service';
import { LLM_PROVIDER } from './domain/llm-provider.port';
import { GeminiProvider } from './infra/gemini.provider';
import { LlmProviderExceptionFilter } from './presentation/llm-provider-exception.filter';
import { StructuredOutputExceptionFilter } from './presentation/structured-output-exception.filter';

@Module({
  providers: [
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
    StructuredOutputService,
    { provide: APP_FILTER, useClass: StructuredOutputExceptionFilter },
    { provide: APP_FILTER, useClass: LlmProviderExceptionFilter },
  ],
  exports: [LLM_PROVIDER, StructuredOutputService],
})
export class LlmModule {}
