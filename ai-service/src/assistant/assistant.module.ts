import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FinancialDataService } from '../financial/application/financial-data.service';
import { FinancialModule } from '../financial/financial.module';
import { KnowledgeSearchService } from '../knowledge/application/knowledge-search.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { LlmModule } from '../llm/llm.module';
import { CLOCK } from '../shared/clock';
import type { Clock } from '../shared/clock';
import { AskAssistantUseCase } from './application/ask-assistant.use-case';
import { createFinancialTools } from './application/tools/financial-tools';
import { createKnowledgeTools } from './application/tools/knowledge-tools';
import { ToolRegistry } from './application/tools/tool-registry';
import { AgentLoopLimitExceptionFilter } from './presentation/agent-loop-limit-exception.filter';
import { AssistantController } from './presentation/assistant.controller';

const systemClock: Clock = () => new Date();

@Module({
  imports: [LlmModule, FinancialModule, KnowledgeModule],
  controllers: [AssistantController],
  providers: [
    {
      provide: ToolRegistry,
      inject: [FinancialDataService, KnowledgeSearchService],
      useFactory: (
        financialData: FinancialDataService,
        knowledgeSearch: KnowledgeSearchService,
      ) =>
        new ToolRegistry([
          ...createFinancialTools(financialData),
          ...createKnowledgeTools(knowledgeSearch),
        ]),
    },
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_FILTER, useClass: AgentLoopLimitExceptionFilter },
    AskAssistantUseCase,
  ],
})
export class AssistantModule {}
