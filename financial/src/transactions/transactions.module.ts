import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
    // precisa do Account aqui porque o service manipula as duas entidades
    imports: [TypeOrmModule.forFeature([Transaction, Account])],
    controllers: [TransactionsController],
    providers: [TransactionsService],
})
export class TransactionsModule { }