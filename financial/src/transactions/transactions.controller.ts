import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import express from 'express';

@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(@Body() dto: CreateTransactionDto, @Req() req: express.Request) {
        const userId = req.headers['x-user-id'] as string;
        const userRole = req.headers['x-user-role'] as string;
        return this.transactionsService.create(dto, userId, userRole);
    }

    @Get('account/:accountId')
    findByAccount(@Param('accountId') accountId: string) {
        return this.transactionsService.findByAccount(accountId);
    }

    @Get('account/:accountId/balance')
    getBalance(@Param('accountId') accountId: string) {
        return this.transactionsService.getBalance(accountId);
    }
}