import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueueService } from '../common/queue/queue.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    // DataSource é usado para transações atômicas
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  // enfileira e retorna imediatamente
  async create(
    dto: CreateTransactionDto,
    requestUserId: string,
    requestUserRole: string,
  ): Promise<{ jobId: string; status: string }> {
    // valida se o usuário logado é dono da conta origem
    if (requestUserRole !== 'ADMIN') {
      const account = await this.accountRepo.findOne({
        where: { id: dto.accountId, active: true },
      });

      if (!account) throw new NotFoundException('Conta não encontrada');

      if (account.userId !== requestUserId) {
        throw new ForbiddenException(
          'Você não tem permissão para movimentar esta conta',
        );
      }
    }

    const jobId = await this.queueService.enqueueTransaction(dto);
    console.log(`[Queue] transação enfileirada — job ${jobId}`);
    return { jobId, status: TransactionStatus.PENDING };
  }

  // chamado pelo worker em background
  async process(dto: CreateTransactionDto): Promise<Transaction> {
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
          throw new BadRequestException(
            'Conta destino é obrigatória para transferência',
          );
        }

        if (Number(account.balance) < dto.amount) {
          throw new BadRequestException('Saldo insuficiente');
        }

        const target = await queryRunner.manager.findOne(Account, {
          where: { id: dto.targetAccountId, active: true },
          lock: { mode: 'pessimistic_write' },
        });

        if (!target)
          throw new NotFoundException('Conta destino não encontrada');

        account.balance = Number(account.balance) - Number(dto.amount);
        target.balance = Number(target.balance) + Number(dto.amount);

        await queryRunner.manager.save(Account, account);
        await queryRunner.manager.save(Account, target);

        // transação de saída — conta origem
        transaction.status = TransactionStatus.COMPLETED;
        await queryRunner.manager.save(Transaction, transaction);

        // transação de entrada — conta destino
        const incomingTransaction = queryRunner.manager.create(Transaction, {
          accountId: dto.targetAccountId,
          type: TransactionType.DEPOSIT, // aparece como depósito no extrato do destino
          amount: dto.amount,
          description: `Transferência recebida de ${dto.accountId}`,
          status: TransactionStatus.COMPLETED,
          targetAccountId: dto.accountId,
        });
        await queryRunner.manager.save(Transaction, incomingTransaction);

        await queryRunner.commitTransaction();

        await this.rabbitMQService.publish('transaction.completed', {
          userId: account.userId,
          accountId: dto.accountId,
          type: dto.type,
          amount: dto.amount,
        });

        return transaction;
      }

      transaction.status = TransactionStatus.COMPLETED;
      await queryRunner.manager.save(Account, account);
      await queryRunner.manager.save(Transaction, transaction);

      // confirma todas as operações de uma vez — atômico
      await queryRunner.commitTransaction();

      await this.rabbitMQService.publish('transaction.completed', {
        userId: account.userId,
        accountId: dto.accountId,
        type: dto.type,
        amount: dto.amount,
      });

      return transaction;
    } catch (err) {
      // só faz rollback se a transação ainda estiver ativa
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
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
      .select(
        `SUM(CASE
                    WHEN t.type IN (:...credits) THEN t.amount
                    ELSE -t.amount
                END)`,
        'balance',
      )
      .where('t.accountId = :accountId AND t.status = :status', {
        accountId,
        status: TransactionStatus.COMPLETED,
      })
      .setParameter('credits', [TransactionType.DEPOSIT])
      .getRawOne();

    return { balance: Number(result?.balance || 0) };
  }
}
