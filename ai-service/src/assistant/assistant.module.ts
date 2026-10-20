import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FinancialDataService } from '../financial/application/financial-data.service';
import { FinancialModule } from '../financial/financial.module';
import { LlmModule } from '../llm/llm.module';
import { CLOCK } from '../shared/clock';
import type { Clock } from '../shared/clock';
import { AskAssistantUseCase } from './application/ask-assistant.use-case';
import { createFinancialTools } from './application/tools/financial-tools';
import { ToolRegistry } from './application/tools/tool-registry';
import { AgentLoopLimitExceptionFilter } from './presentation/agent-loop-limit-exception.filter';
import { AssistantController } from './presentation/assistant.controller';

const systemClock: Clock = () => new Date();

@Module({
  imports: [LlmModule, FinancialModule],
  controllers: [AssistantController],
  providers: [
    {
      provide: ToolRegistry,
      inject: [FinancialDataService],
      useFactory: (financialData: FinancialDataService) =>
        new ToolRegistry(createFinancialTools(financialData)),
    },
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_FILTER, useClass: AgentLoopLimitExceptionFilter },
    AskAssistantUseCase,
  ],
})
export class AssistantModule {}
