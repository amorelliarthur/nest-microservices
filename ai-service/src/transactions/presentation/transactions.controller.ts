import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ClassifyTransactionUseCase } from '../application/classify-transaction.use-case';
import { classifyTransactionSchema } from './classify-transaction.schema';
import type { ClassifyTransactionInput } from './classify-transaction.schema';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly classifyTransaction: ClassifyTransactionUseCase,
  ) {}

  @Post('classify')
  @HttpCode(HttpStatus.OK)
  classify(
    @Body(new ZodValidationPipe(classifyTransactionSchema))
    input: ClassifyTransactionInput,
  ) {
    return this.classifyTransaction.execute(input.description);
  }
}
