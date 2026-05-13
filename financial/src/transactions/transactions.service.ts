import {
    Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction, TransactionStatus, TransactionType } from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepo: Repository<Transaction>,
        @InjectRepository(Account)
        private readonly accountRepo: Repository<Account>,
        // DataSource é usado para transações atômicas
        private readonly dataSource: DataSource,
    ) { }

    async create(dto: CreateTransactionDto): Promise<Transaction> {
        // queryRunner é o mecanismo de transação do TypeORM
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const account = await queryRunner.manager.findOne(Account, {
                where: { id: dto.accountId, active: true },
                // LOCK garante que nenhuma outra transação altere o saldo ao mesmo tempo
                lock: { mode: 'pessimistic_write' },
            });

            if (!account) throw new NotFoundException('Conta não encontrada');

            const transaction = queryRunner.manager.create(Transaction, {
                ...dto,
                status: TransactionStatus.PENDING,
            });

            if (dto.type === TransactionType.DEPOSIT) {
                account.balance = Number(account.balance) + Number(dto.amount);
            }

            if (dto.type === TransactionType.WITHDRAWAL) {
                if (Number(account.balance) < dto.amount) {
                    throw new BadRequestException('Saldo insuficiente');
                }
                account.balance = Number(account.balance) - Number(dto.amount);
            }

            if (dto.type === TransactionType.TRANSFER) {
                if (!dto.targetAccountId) {
                    throw new BadRequestException('Conta destino é obrigatória para transferência');
                }

                if (Number(account.balance) < dto.amount) {
                    throw new BadRequestException('Saldo insuficiente');
                }

                const target = await queryRunner.manager.findOne(Account, {
                    where: { id: dto.targetAccountId, active: true },
                    lock: { mode: 'pessimistic_write' },
                });

                if (!target) throw new NotFoundException('Conta destino não encontrada');

                account.balance = Number(account.balance) - Number(dto.amount);
                target.balance = Number(target.balance) + Number(dto.amount);

                await queryRunner.manager.save(Account, target);
            }

            transaction.status = TransactionStatus.COMPLETED;
            await queryRunner.manager.save(Account, account);
            await queryRunner.manager.save(Transaction, transaction);

            // confirma todas as operações de uma vez — atômico
            await queryRunner.commitTransaction();
            return transaction;

        } catch (err) {
            // se qualquer operação falhar, desfaz tudo
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            // sempre libera o queryRunner
            await queryRunner.release();
        }
    }

    // extrato com query otimizada pelo índice composto
    async findByAccount(accountId: string): Promise<Transaction[]> {
        return this.transactionRepo.find({
            where: { accountId },
            order: { createdAt: 'DESC' },
        });
    }

    // saldo calculado via query SQL pura — exemplo de query avançada
    async getBalance(accountId: string): Promise<{ balance: number }> {
        const result = await this.transactionRepo
            .createQueryBuilder('t')
            .select('SUM(CASE WHEN t.type = :deposit THEN t.amount ELSE -t.amount END)', 'balance')
            .where('t.accountId = :accountId AND t.status = :status', {
                accountId,
                deposit: TransactionType.DEPOSIT,
                status: TransactionStatus.COMPLETED,
            })
            .getRawOne();

        return { balance: Number(result?.balance || 0) };
    }
}