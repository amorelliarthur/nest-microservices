import {
  Injectable,
  Logger,
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
import { GENERIC_FAILURE_REASON } from '../common/queue/job-error';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { assertAccountAccess } from '../accounts/account-access';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

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

  // grava a transação como PENDING, enfileira e retorna imediatamente
  async create(
    dto: CreateTransactionDto,
    requester: Requester,
  ): Promise<{ transactionId: string; jobId: string; status: string }> {
    this.assertDistinctAccounts(dto);

    // valida se a conta origem existe e se o usuário logado pode movimentá-la
    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId, active: true },
    });

    if (!account) throw new NotFoundException('Conta não encontrada');

    if (!canAccess(requester, account.userId)) {
      throw new ForbiddenException(
        'Você não tem permissão para movimentar esta conta',
      );
    }

    // gravada antes de enfileirar: o status pode ser consultado desde já e,
    // se o processamento falhar, a transação continua registrada como FAILED
    const transaction = await this.transactionRepo.save(
      this.transactionRepo.create({
        ...dto,
        status: TransactionStatus.PENDING,
      }),
    );

    let jobId: string;
    try {
      jobId = await this.queueService.enqueueTransaction(transaction.id);
    } catch (err) {
      // sem job, ninguém processaria a transação: ela não pode ficar PENDING
      await this.markFailed(transaction.id, GENERIC_FAILURE_REASON);
      throw err;
    }

    this.logger.log(`Transaction ${transaction.id} enqueued as job ${jobId}`);
    return {
      transactionId: transaction.id,
      jobId,
      status: TransactionStatus.PENDING,
    };
  }

  // Só altera transações ainda PENDING: nunca sobrescreve uma já concluída
  async markFailed(transactionId: string, reason: string): Promise<void> {
    this.assertTransactionId(transactionId);
    await this.transactionRepo.update(
      { id: transactionId, status: TransactionStatus.PENDING },
      { status: TransactionStatus.FAILED, failureReason: reason },
    );
  }

  // chamado pelo worker em background, com a transação gravada no create()
  async process(transactionId: string): Promise<Transaction> {
    this.assertTransactionId(transactionId);

    // queryRunner é o mecanismo de transação do TypeORM
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // o lock impede que dois workers processem a mesma transação ao mesmo tempo
      const transaction: Transaction | null = await queryRunner.manager.findOne(
        Transaction,
        {
          where: { id: transactionId },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!transaction) throw new NotFoundException('Transação não encontrada');

      // job repetido (ex.: worker caiu depois do commit): não movimenta de novo
      if (transaction.status !== TransactionStatus.PENDING) {
        this.logger.warn(
          `Transaction ${transactionId} is already ${transaction.status}, skipping`,
        );
        await queryRunner.commitTransaction();
        return transaction;
      }

      this.assertDistinctAccounts(transaction);

      // colunas decimal chegam do banco como texto
      const amount = Number(transaction.amount);

      const account: Account | null = await queryRunner.manager.findOne(
        Account,
        {
          where: { id: transaction.accountId, active: true },
          // LOCK garante que nenhuma outra transação altere o saldo ao mesmo tempo
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!account) throw new NotFoundException('Conta não encontrada');

      if (transaction.type === TransactionType.DEPOSIT) {
        account.balance = Number(account.balance) + amount;
      }

      if (transaction.type === TransactionType.WITHDRAWAL) {
        if (Number(account.balance) < amount) {
          throw new BadRequestException('Saldo insuficiente');
        }
        account.balance = Number(account.balance) - amount;
      }

      if (transaction.type === TransactionType.TRANSFER) {
        if (!transaction.targetAccountId) {
          throw new BadRequestException(
            'Conta destino é obrigatória para transferência',
          );
        }

        if (Number(account.balance) < amount) {
          throw new BadRequestException('Saldo insuficiente');
        }

        const target: Account | null = await queryRunner.manager.findOne(
          Account,
          {
            where: { id: transaction.targetAccountId, active: true },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!target)
          throw new NotFoundException('Conta destino não encontrada');

        account.balance = Number(account.balance) - amount;
        target.balance = Number(target.balance) + amount;

        await queryRunner.manager.save(Account, account);
        await queryRunner.manager.save(Account, target);

        // transação de saída — conta origem
        transaction.status = TransactionStatus.COMPLETED;
        await queryRunner.manager.save(Transaction, transaction);

        // transação de entrada — conta destino
        const incomingTransaction = queryRunner.manager.create(Transaction, {
          accountId: transaction.targetAccountId,
          type: TransactionType.DEPOSIT, // aparece como depósito no extrato do destino
          amount,
          description: `Transferência recebida de ${transaction.accountId}`,
          status: TransactionStatus.COMPLETED,
          targetAccountId: transaction.accountId,
        });
        await queryRunner.manager.save(Transaction, incomingTransaction);

        await queryRunner.commitTransaction();

        await this.rabbitMQService.publish('transaction.completed', {
          userId: account.userId,
          accountId: transaction.accountId,
          type: transaction.type,
          amount,
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
        accountId: transaction.accountId,
        type: transaction.type,
        amount,
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

  // status de uma transação (PENDING, COMPLETED ou FAILED, com o motivo)
  async findById(id: string, requester: Requester): Promise<Transaction> {
    const transaction = await this.transactionRepo.findOne({ where: { id } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    const account = await this.accountRepo.findOne({
      where: { id: transaction.accountId },
    });
    // transação de outro usuário responde igual a uma inexistente
    if (!account || !canAccess(requester, account.userId)) {
      throw new NotFoundException('Transação não encontrada');
    }
    return transaction;
  }

  // extrato com query otimizada pelo índice composto
  async findByAccount(
    accountId: string,
    requester: Requester,
  ): Promise<Transaction[]> {
    await this.assertCanReadAccount(accountId, requester);

    return this.transactionRepo.find({
      where: { accountId },
      order: { createdAt: 'DESC' },
    });
  }

  // saldo calculado via query SQL pura — exemplo de query avançada
  async getBalance(
    accountId: string,
    requester: Requester,
  ): Promise<{ balance: number }> {
    await this.assertCanReadAccount(accountId, requester);

    const result: { balance: string | null } | undefined =
      await this.transactionRepo
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

  // Confere o dono antes de qualquer consulta às transações da conta
  private async assertCanReadAccount(
    accountId: string,
    requester: Requester,
  ): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId },
    });
    assertAccountAccess(account, requester);
  }

  // O TypeORM ignora `undefined` no where: sem esta checagem, um id vazio
  // pegaria uma transação qualquer (ou todas as PENDING, no markFailed)
  private assertTransactionId(transactionId: string): void {
    if (!transactionId) throw new Error('transactionId is required');
  }

  // Transferir para a própria conta não é permitido: o débito seria sobrescrito pelo crédito
  private assertDistinctAccounts(
    dto: Pick<CreateTransactionDto, 'type' | 'accountId' | 'targetAccountId'>,
  ): void {
    if (
      dto.type === TransactionType.TRANSFER &&
      dto.targetAccountId === dto.accountId
    ) {
      throw new BadRequestException(
        'Conta destino deve ser diferente da conta de origem',
      );
    }
  }
}
