import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CurrentRequester } from '../common/auth/current-requester.decorator';
import type { Requester } from '../common/auth/requester';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentRequester() requester: Requester,
  ) {
    return this.transactionsService.create(dto, requester);
  }

  @Get('account/:accountId')
  findByAccount(
    @Param('accountId') accountId: string,
    @CurrentRequester() requester: Requester,
  ) {
    return this.transactionsService.findByAccount(accountId, requester);
  }

  @Get('account/:accountId/balance')
  getBalance(
    @Param('accountId') accountId: string,
    @CurrentRequester() requester: Requester,
  ) {
    return this.transactionsService.getBalance(accountId, requester);
  }
}
