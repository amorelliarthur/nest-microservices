import { Module } from '@nestjs/common';
import { StructuredOutputService } from './application/structured-output.service';
import { LLM_PROVIDER } from './domain/llm-provider.port';
import { GeminiProvider } from './infra/gemini.provider';

@Module({
  providers: [
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
    StructuredOutputService,
  ],
  exports: [LLM_PROVIDER, StructuredOutputService],
})
export class LlmModule {}
