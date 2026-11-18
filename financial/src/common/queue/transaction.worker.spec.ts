import { BadRequestException, Logger } from '@nestjs/common';
import { UnrecoverableError, Worker } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TransactionWorker } from './transaction.worker';

jest.mock('bullmq', () => ({
  ...jest.requireActual<typeof import('bullmq')>('bullmq'),
  Worker: jest.fn(),
}));

describe('TransactionWorker', () => {
  afterEach(() => jest.restoreAllMocks());

  it('deve processar a transação gravada pelo id que veio no job', async () => {
    let processor!: (job: unknown) => Promise<void>;
    (Worker as unknown as jest.Mock).mockImplementation(
      (_queue: string, fn: (job: unknown) => Promise<void>) => {
        processor = fn;
        return { on: jest.fn(), close: jest.fn() };
      },
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const process = jest.fn().mockResolvedValue(undefined);
    const worker = new TransactionWorker(
      { getConnectionOptions: () => ({}) } as unknown as RedisService,
      { process } as unknown as TransactionsService,
    );
    worker.onModuleInit();

    await processor({ id: '7', data: { transactionId: 'tx-1' } });

    expect(process).toHaveBeenCalledWith('tx-1');
  });

  it('deve registrar a falha de um job como erro no Logger', () => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    (Worker as unknown as jest.Mock).mockImplementation(() => ({
      on: (event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      },
      close: jest.fn(),
    }));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const worker = new TransactionWorker(
      { getConnectionOptions: () => ({}) } as unknown as RedisService,
      {} as TransactionsService,
    );
    worker.onModuleInit();

    const failure = new Error('saldo insuficiente');
    handlers['failed']({ id: '42' }, failure);

    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/42.*saldo insuficiente/),
      failure.stack,
    );
  });

  describe('quando o processamento falha', () => {
    const setup = () => {
      let processor!: (job: unknown) => Promise<void>;
      (Worker as unknown as jest.Mock).mockImplementation(
        (_queue: string, fn: (job: unknown) => Promise<void>) => {
          processor = fn;
          return { on: jest.fn(), close: jest.fn() };
        },
      );
      jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const service = { process: jest.fn(), markFailed: jest.fn() };
      new TransactionWorker(
        { getConnectionOptions: () => ({}) } as unknown as RedisService,
        service as unknown as TransactionsService,
      ).onModuleInit();
      const job = (attemptsMade: number) => ({
        id: '7',
        data: { transactionId: 'tx-1' },
        attemptsMade,
        opts: { attempts: 3 },
      });
      return { processor: () => processor, service, error, job };
    };

    it('deve marcar como FAILED com a mensagem da regra de negócio, sem novas tentativas', async () => {
      const { processor, service, job } = setup();
      service.process.mockRejectedValue(
        new BadRequestException('Saldo insuficiente'),
      );

      await expect(processor()(job(0))).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
      expect(service.markFailed).toHaveBeenCalledWith(
        'tx-1',
        'Saldo insuficiente',
      );
    });

    it('não deve marcar como FAILED um erro temporário que ainda será repetido', async () => {
      const { processor, service, job } = setup();
      const falha = new Error('connect ECONNREFUSED');
      service.process.mockRejectedValue(falha);

      await expect(processor()(job(1))).rejects.toBe(falha);
      expect(service.markFailed).not.toHaveBeenCalled();
    });

    it('deve marcar como FAILED com mensagem genérica quando acabam as tentativas', async () => {
      const { processor, service, job } = setup();
      const falha = new Error('connect ECONNREFUSED');
      service.process.mockRejectedValue(falha);

      await expect(processor()(job(2))).rejects.toBe(falha);
      expect(service.markFailed).toHaveBeenCalledWith(
        'tx-1',
        'Não foi possível processar a transação',
      );
    });

    it('deve registrar o erro e manter a falha do job quando não consegue marcar como FAILED', async () => {
      const { processor, service, error, job } = setup();
      service.process.mockRejectedValue(
        new BadRequestException('Saldo insuficiente'),
      );
      const falhaAoMarcar = new Error('banco indisponível');
      service.markFailed.mockRejectedValue(falhaAoMarcar);

      await expect(processor()(job(0))).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/tx-1.*banco indisponível/),
        falhaAoMarcar.stack,
      );
    });
  });
});
