import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { Account } from '../accounts/entities/account.entity';
import { QueueService } from '../common/queue/queue.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  const mockTransactionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockAccountRepo = {
    findOne: jest.fn(),
  };

  const mockQueueService = {
    enqueueTransaction: jest.fn(),
  };

  const mockRabbitMQService = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: QueueService, useValue: mockQueueService },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);

    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQueryRunner.connect.mockResolvedValue(undefined);
    mockQueryRunner.startTransaction.mockResolvedValue(undefined);
    mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
    mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
    mockQueryRunner.release.mockResolvedValue(undefined);
    mockQueryRunner.manager.save.mockResolvedValue(undefined);
    mockQueryRunner.manager.create.mockImplementation(
      (_: unknown, data: object) => ({ ...data }),
    );
    mockRabbitMQService.publish.mockResolvedValue(undefined);
    mockTransactionRepo.create.mockImplementation((data: object) => ({
      ...data,
    }));
    mockTransactionRepo.save.mockImplementation((data: object) =>
      Promise.resolve({ id: 'tx-1', ...data }),
    );
  });

  afterEach(() => jest.resetAllMocks());

  describe('create()', () => {
    it('deve rejeitar transferência para a mesma conta sem enfileirar', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-1',
        balance: 1000,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);

      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.TRANSFER,
        amount: 100,
        targetAccountId: 'acc-1',
      };

      const promise = service.create(dto, { id: 'user-1', role: 'USER' });

      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Conta destino deve ser diferente da conta de origem',
      );
      expect(mockQueueService.enqueueTransaction).not.toHaveBeenCalled();
      expect(mockTransactionRepo.save).not.toHaveBeenCalled();
    });

    it('deve enfileirar quando o usuário é dono da conta', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-1',
        balance: 1000,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);
      mockQueueService.enqueueTransaction.mockResolvedValue('job-1');

      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.DEPOSIT,
        amount: 100,
      };

      const result = await service.create(dto, { id: 'user-1', role: 'USER' });

      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'acc-1', active: true },
      });
      expect(mockQueueService.enqueueTransaction).toHaveBeenCalledWith('tx-1');
      expect(result).toEqual({
        transactionId: 'tx-1',
        jobId: 'job-1',
        status: 'PENDING',
      });
    });

    it('deve lançar ForbiddenException quando o usuário não é dono da conta', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-2',
        balance: 1000,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);

      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.WITHDRAWAL,
        amount: 100,
      };

      await expect(
        service.create(dto, { id: 'user-1', role: 'USER' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockQueueService.enqueueTransaction).not.toHaveBeenCalled();
    });

    it('deve permitir que ADMIN movimente conta de outro usuário', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-2',
        balance: 1000,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);
      mockQueueService.enqueueTransaction.mockResolvedValue('job-1');

      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.WITHDRAWAL,
        amount: 100,
      };

      const result = await service.create(dto, {
        id: 'admin-1',
        role: 'ADMIN',
      });

      expect(mockQueueService.enqueueTransaction).toHaveBeenCalledWith('tx-1');
      expect(result).toEqual({
        transactionId: 'tx-1',
        jobId: 'job-1',
        status: 'PENDING',
      });
    });

    it('deve gravar a transação como PENDING antes de enfileirar', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        active: true,
      });
      mockQueueService.enqueueTransaction.mockResolvedValue('job-1');
      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.TRANSFER,
        amount: 100,
        description: 'Reserva',
        targetAccountId: 'acc-2',
      };

      await service.create(dto, { id: 'user-1', role: 'USER' });

      expect(mockTransactionRepo.save).toHaveBeenCalledWith({
        ...dto,
        status: TransactionStatus.PENDING,
      });
      expect(mockTransactionRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
        mockQueueService.enqueueTransaction.mock.invocationCallOrder[0],
      );
    });

    it('deve marcar a transação como FAILED quando não consegue enfileirar', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        active: true,
      });
      const falha = new Error('Redis indisponível');
      mockQueueService.enqueueTransaction.mockRejectedValue(falha);
      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.DEPOSIT,
        amount: 100,
      };

      await expect(
        service.create(dto, { id: 'user-1', role: 'USER' }),
      ).rejects.toBe(falha);
      expect(mockTransactionRepo.update).toHaveBeenCalledWith(
        { id: 'tx-1', status: TransactionStatus.PENDING },
        {
          status: TransactionStatus.FAILED,
          failureReason: 'Não foi possível processar a transação',
        },
      );
    });

    it('deve relançar o erro do enfileiramento e registrar em log quando também não consegue marcar como FAILED', async () => {
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
        active: true,
      });
      const falha = new Error('Redis indisponível');
      mockQueueService.enqueueTransaction.mockRejectedValue(falha);
      const falhaAoMarcar = new Error('banco indisponível');
      mockTransactionRepo.update.mockRejectedValue(falhaAoMarcar);
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const dto: CreateTransactionDto = {
        accountId: 'acc-1',
        type: TransactionType.DEPOSIT,
        amount: 100,
      };

      await expect(
        service.create(dto, { id: 'user-1', role: 'USER' }),
      ).rejects.toBe(falha);
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/tx-1.*banco indisponível/),
        falhaAoMarcar.stack,
      );
    });

    it('deve lançar NotFoundException quando a conta não existe', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      const dto: CreateTransactionDto = {
        accountId: 'acc-inexistente',
        type: TransactionType.DEPOSIT,
        amount: 100,
      };

      await expect(
        service.create(dto, { id: 'user-1', role: 'USER' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueueService.enqueueTransaction).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando ADMIN movimenta conta inexistente, sem enfileirar', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      const dto: CreateTransactionDto = {
        accountId: 'acc-inexistente',
        type: TransactionType.DEPOSIT,
        amount: 100,
      };

      await expect(
        service.create(dto, { id: 'admin-1', role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueueService.enqueueTransaction).not.toHaveBeenCalled();
    });
  });

  describe('markFailed()', () => {
    it('deve alterar somente a transação indicada, e só se ainda estiver PENDING', async () => {
      await service.markFailed('tx-1', 'Saldo insuficiente');

      expect(mockTransactionRepo.update).toHaveBeenCalledWith(
        { id: 'tx-1', status: TransactionStatus.PENDING },
        {
          status: TransactionStatus.FAILED,
          failureReason: 'Saldo insuficiente',
        },
      );
    });

    it('deve recusar um id vazio, que o TypeORM ignoraria no where', async () => {
      await expect(
        service.markFailed(undefined as unknown as string, 'x'),
      ).rejects.toThrow();
      expect(mockTransactionRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('failStalePending()', () => {
    const setupUpdate = (affected?: number) => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      mockTransactionRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('deve marcar como FAILED, com mensagem genérica, só as PENDING', async () => {
      const qb = setupUpdate(2);

      await service.failStalePending(600_000);

      expect(qb.update).toHaveBeenCalledWith(Transaction);
      expect(qb.set).toHaveBeenCalledWith({
        status: TransactionStatus.FAILED,
        failureReason: 'Não foi possível processar a transação',
      });
      expect(qb.where).toHaveBeenCalledWith('status = :status', {
        status: TransactionStatus.PENDING,
      });
    });

    it('deve calcular o prazo com o relógio do banco, sem enviar datas do Node', async () => {
      const qb = setupUpdate(2);

      await service.failStalePending(600_000);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'created_at < now()::timestamp - make_interval(secs => :seconds)',
        { seconds: 600 },
      );
    });

    it('deve devolver quantas transações foram encerradas', async () => {
      setupUpdate(2);

      await expect(service.failStalePending(600_000)).resolves.toBe(2);
    });

    it('deve devolver zero quando o banco não informa as linhas afetadas', async () => {
      setupUpdate(undefined);

      await expect(service.failStalePending(600_000)).resolves.toBe(0);
    });
  });

  describe('process()', () => {
    // A transação gravada como PENDING no create(): é ela que o worker processa
    const pendente = (dto: CreateTransactionDto) => ({
      id: 'tx-1',
      status: TransactionStatus.PENDING,
      ...dto,
    });

    it('deve carregar a transação pelo id com lock antes de movimentar o saldo', async () => {
      const account = { id: 'acc-1', userId: 'user-1', balance: 10 };
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce(
          pendente({
            accountId: 'acc-1',
            type: TransactionType.DEPOSIT,
            amount: 5,
          }),
        )
        .mockResolvedValueOnce(account);

      await service.process('tx-1');

      expect(mockQueryRunner.manager.findOne).toHaveBeenNthCalledWith(
        1,
        Transaction,
        { where: { id: 'tx-1' }, lock: { mode: 'pessimistic_write' } },
      );
    });

    it('deve recusar um id vazio sem consultar o banco, que o TypeORM ignoraria no where', async () => {
      await expect(
        service.process(undefined as unknown as string),
      ).rejects.toThrow();
      expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando a transação não existe', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(service.process('tx-x')).rejects.toThrow(
        'Transação não encontrada',
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it.each([TransactionStatus.COMPLETED, TransactionStatus.FAILED])(
      'deve ignorar uma transação já %s, sem movimentar saldo de novo',
      async (status) => {
        const jaProcessada = {
          ...pendente({
            accountId: 'acc-1',
            type: TransactionType.DEPOSIT,
            amount: 5,
          }),
          status,
        };
        mockQueryRunner.manager.findOne.mockResolvedValueOnce(jaProcessada);

        const result = await service.process('tx-1');

        expect(result).toBe(jaProcessada);
        expect(mockQueryRunner.manager.findOne).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
        expect(mockRabbitMQService.publish).not.toHaveBeenCalled();
      },
    );

    describe('DEPOSIT', () => {
      it('deve incrementar o saldo e concluir a transação gravada', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.DEPOSIT,
              amount: 200,
            }),
          )
          .mockResolvedValueOnce(account);

        await service.process('tx-1');

        expect(account.balance).toBe(1200);
        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
          Transaction,
          expect.objectContaining({
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          }),
        );
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockRabbitMQService.publish).toHaveBeenCalledWith(
          'transaction.completed',
          expect.objectContaining({
            accountId: 'acc-1',
            type: TransactionType.DEPOSIT,
          }),
        );
      });
    });

    describe('WITHDRAWAL', () => {
      it('deve decrementar o saldo da conta', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.WITHDRAWAL,
              amount: 300,
            }),
          )
          .mockResolvedValueOnce(account);

        await service.process('tx-1');

        expect(account.balance).toBe(700);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      });

      it('deve lançar BadRequestException quando saldo insuficiente', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 100,
          active: true,
        };
        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.WITHDRAWAL,
              amount: 500,
            }),
          )
          .mockResolvedValueOnce(account);

        await expect(service.process('tx-1')).rejects.toThrow(
          BadRequestException,
        );
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      });
    });

    describe('TRANSFER', () => {
      it('deve rejeitar transferência para a mesma conta sem movimentar saldo', async () => {
        mockQueryRunner.manager.findOne.mockResolvedValueOnce(
          pendente({
            accountId: 'acc-1',
            type: TransactionType.TRANSFER,
            amount: 100,
            targetAccountId: 'acc-1',
          }),
        );

        const promise = service.process('tx-1');

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow(
          'Conta destino deve ser diferente da conta de origem',
        );
        expect(mockQueryRunner.manager.findOne).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.manager.save).not.toHaveBeenCalled();
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      });

      it('deve debitar da conta de origem e creditar na conta de destino', async () => {
        const sourceAccount = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        const targetAccount = {
          id: 'acc-2',
          userId: 'user-2',
          balance: 500,
          active: true,
        };

        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.TRANSFER,
              amount: 300,
              targetAccountId: 'acc-2',
            }),
          )
          .mockResolvedValueOnce(sourceAccount)
          .mockResolvedValueOnce(targetAccount);

        await service.process('tx-1');

        expect(sourceAccount.balance).toBe(700);
        expect(targetAccount.balance).toBe(800);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(4);
        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
          Transaction,
          expect.objectContaining({
            id: 'tx-1',
            status: TransactionStatus.COMPLETED,
          }),
        );
      });

      it('deve lançar BadRequestException quando targetAccountId não é informado', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.TRANSFER,
              amount: 300,
            }),
          )
          .mockResolvedValueOnce(account);

        const promise = service.process('tx-1');

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow('Conta destino é obrigatória');
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      });

      it('deve lançar BadRequestException quando saldo insuficiente para transferência', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 100,
          active: true,
        };
        mockQueryRunner.manager.findOne
          .mockResolvedValueOnce(
            pendente({
              accountId: 'acc-1',
              type: TransactionType.TRANSFER,
              amount: 500,
              targetAccountId: 'acc-2',
            }),
          )
          .mockResolvedValueOnce(account);

        const promise = service.process('tx-1');

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow('Saldo insuficiente');
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('findById()', () => {
    const transacao = {
      id: 'tx-1',
      accountId: 'acc-1',
      status: TransactionStatus.FAILED,
      failureReason: 'Saldo insuficiente',
    };

    it('deve retornar a transação com status e motivo quando o usuário é dono da conta', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(transacao);
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-1',
      });

      const result = await service.findById('tx-1', {
        id: 'user-1',
        role: 'USER',
      });

      expect(result).toBe(transacao);
      expect(mockTransactionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
      expect(mockAccountRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
    });

    it('deve permitir que ADMIN consulte a transação de outro usuário', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(transacao);
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-2',
      });

      await expect(
        service.findById('tx-1', { id: 'admin-1', role: 'ADMIN' }),
      ).resolves.toBe(transacao);
    });

    it('deve responder 404 para transação de outro usuário, igual a uma inexistente', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(transacao);
      mockAccountRepo.findOne.mockResolvedValue({
        id: 'acc-1',
        userId: 'user-2',
      });

      const promise = service.findById('tx-1', { id: 'user-1', role: 'USER' });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Transação não encontrada');
    });

    it('deve responder 404 de transação quando a conta dela não existe mais', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(transacao);
      mockAccountRepo.findOne.mockResolvedValue(null);

      const promise = service.findById('tx-1', { id: 'user-1', role: 'USER' });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Transação não encontrada');
    });

    it('deve lançar NotFoundException quando a transação não existe', async () => {
      mockTransactionRepo.findOne.mockResolvedValue(null);

      const promise = service.findById('tx-x', { id: 'user-1', role: 'USER' });

      await expect(promise).rejects.toThrow('Transação não encontrada');
      expect(mockAccountRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findByAccount()', () => {
    it('deve retornar o extrato quando o usuário é dono da conta', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-1',
        balance: 1000,
        active: true,
      };
      const transactions = [{ id: 'tx-1', accountId: 'acc-1' }];
      mockAccountRepo.findOne.mockResolvedValue(account);
      mockTransactionRepo.find.mockResolvedValue(transactions);

      const result = await service.findByAccount('acc-1', {
        id: 'user-1',
        role: 'USER',
      });

      expect(result).toBe(transactions);
    });

    it('deve lançar NotFoundException para conta de outro usuário sem consultar as transações', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-2',
        balance: 1000,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);

      const promise = service.findByAccount('acc-1', {
        id: 'user-1',
        role: 'USER',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Conta não encontrada');
      expect(mockTransactionRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getBalance()', () => {
    const mockQueryBuilder = {
      select: jest.fn(),
      where: jest.fn(),
      setParameter: jest.fn(),
      getRawOne: jest.fn(),
    };

    beforeEach(() => {
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.setParameter.mockReturnValue(mockQueryBuilder);
      mockTransactionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('deve retornar o saldo quando o usuário é dono da conta', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-1',
        balance: 700,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);
      mockQueryBuilder.getRawOne.mockResolvedValue({ balance: '700.00' });

      const result = await service.getBalance('acc-1', {
        id: 'user-1',
        role: 'USER',
      });

      expect(result).toEqual({ balance: 700 });
    });

    it('deve lançar NotFoundException para conta de outro usuário sem consultar as transações', async () => {
      const account = {
        id: 'acc-1',
        userId: 'user-2',
        balance: 700,
        active: true,
      };
      mockAccountRepo.findOne.mockResolvedValue(account);

      const promise = service.getBalance('acc-1', {
        id: 'user-1',
        role: 'USER',
      });

      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow('Conta não encontrada');
      expect(mockTransactionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
