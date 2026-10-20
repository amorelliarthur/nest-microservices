import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ClassifyTransactionUseCase } from './application/classify-transaction.use-case';
import { TransactionsController } from './presentation/transactions.controller';

@Module({
  imports: [LlmModule],
  controllers: [TransactionsController],
  providers: [ClassifyTransactionUseCase],
})
export class TransactionsModule {}
