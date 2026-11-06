import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { StructuredOutputService } from './application/structured-output.service';
import { EMBEDDING_PROVIDER } from './domain/embedding-provider.port';
import { LLM_PROVIDER } from './domain/llm-provider.port';
import { createEmbeddingProvider } from './infra/embedding-provider.factory';
import { createLlmProvider } from './infra/llm-provider.factory';
import { LlmProviderExceptionFilter } from './presentation/llm-provider-exception.filter';
import { StructuredOutputExceptionFilter } from './presentation/structured-output-exception.filter';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: createLlmProvider,
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService],
      useFactory: createEmbeddingProvider,
    },
    StructuredOutputService,
    { provide: APP_FILTER, useClass: StructuredOutputExceptionFilter },
    { provide: APP_FILTER, useClass: LlmProviderExceptionFilter },
  ],
  exports: [LLM_PROVIDER, EMBEDDING_PROVIDER, StructuredOutputService],
})
export class LlmModule {}
