import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './entities/transaction.entity';
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
      expect(mockQueueService.enqueueTransaction).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ jobId: 'job-1', status: 'PENDING' });
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

      expect(mockQueueService.enqueueTransaction).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ jobId: 'job-1', status: 'PENDING' });
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
  });

  describe('process()', () => {
    describe('DEPOSIT', () => {
      it('deve incrementar o saldo da conta', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        mockQueryRunner.manager.findOne.mockResolvedValue(account);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.DEPOSIT,
          amount: 200,
        };

        await service.process(dto);

        expect(account.balance).toBe(1200);
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
        mockQueryRunner.manager.findOne.mockResolvedValue(account);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.WITHDRAWAL,
          amount: 300,
        };

        await service.process(dto);

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
        mockQueryRunner.manager.findOne.mockResolvedValue(account);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.WITHDRAWAL,
          amount: 500,
        };

        await expect(service.process(dto)).rejects.toThrow(BadRequestException);
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      });
    });

    describe('TRANSFER', () => {
      it('deve rejeitar transferência para a mesma conta sem abrir transação no banco', async () => {
        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 100,
          targetAccountId: 'acc-1',
        };

        const promise = service.process(dto);

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow(
          'Conta destino deve ser diferente da conta de origem',
        );
        expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled();
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
          .mockResolvedValueOnce(sourceAccount)
          .mockResolvedValueOnce(targetAccount);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 300,
          targetAccountId: 'acc-2',
        };

        await service.process(dto);

        expect(sourceAccount.balance).toBe(700);
        expect(targetAccount.balance).toBe(800);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalledTimes(1);
        expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(4);
      });

      it('deve lançar BadRequestException quando targetAccountId não é informado', async () => {
        const account = {
          id: 'acc-1',
          userId: 'user-1',
          balance: 1000,
          active: true,
        };
        mockQueryRunner.manager.findOne.mockResolvedValue(account);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 300,
        };

        const promise = service.process(dto);

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
        mockQueryRunner.manager.findOne.mockResolvedValue(account);

        const dto: CreateTransactionDto = {
          accountId: 'acc-1',
          type: TransactionType.TRANSFER,
          amount: 500,
          targetAccountId: 'acc-2',
        };

        const promise = service.process(dto);

        await expect(promise).rejects.toThrow(BadRequestException);
        await expect(promise).rejects.toThrow('Saldo insuficiente');
        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      });
    });
  });
});
