import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './domain/llm-provider.port';
import { GeminiProvider } from './infra/gemini.provider';

@Module({
  providers: [{ provide: LLM_PROVIDER, useClass: GeminiProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
