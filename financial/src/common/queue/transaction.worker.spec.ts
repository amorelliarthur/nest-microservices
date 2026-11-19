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

    await processor({
      id: '7',
      data: { transactionId: '6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d' },
    });

    expect(process).toHaveBeenCalledWith(
      '6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d',
    );
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

  describe('ao registrar a falha de um job', () => {
    const setup = () => {
      const handlers: Record<string, (...args: unknown[]) => void> = {};
      (Worker as unknown as jest.Mock).mockImplementation(() => ({
        on: (event: string, handler: (...args: unknown[]) => void) => {
          handlers[event] = handler;
        },
        close: jest.fn(),
      }));
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      new TransactionWorker(
        { getConnectionOptions: () => ({}) } as unknown as RedisService,
        {} as TransactionsService,
      ).onModuleInit();
      // no evento 'failed' o BullMQ já contou a tentativa que falhou
      const job = (attemptsMade: number) => ({
        id: '7',
        attemptsMade,
        opts: { attempts: 3 },
      });
      return { failed: handlers['failed'], warn, error, job };
    };

    it('deve registrar como aviso uma falha temporária que ainda será repetida', () => {
      const { failed, warn, error, job } = setup();

      failed(job(1), new Error('connect ECONNREFUSED'));

      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/7.*1\/3.*will be retried.*ECONNREFUSED/),
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('deve registrar como erro a falha da última tentativa', () => {
      const { failed, warn, error, job } = setup();
      const falha = new Error('connect ECONNREFUSED');

      failed(job(3), falha);

      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/7.*3\/3.*no more retries.*ECONNREFUSED/),
        falha.stack,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('deve registrar como erro definitivo um UnrecoverableError, mesmo com tentativas sobrando', () => {
      const { failed, warn, error, job } = setup();
      const falha = new UnrecoverableError('Saldo insuficiente');

      failed(job(1), falha);

      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/7.*unrecoverable.*Saldo insuficiente/),
        falha.stack,
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('deve registrar como erro uma falha sem o job', () => {
      const { failed, warn, error } = setup();
      const falha = new Error('lock perdido');

      failed(undefined, falha);

      expect(error).toHaveBeenCalledWith(
        expect.stringMatching(/lock perdido/),
        falha.stack,
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  it.each([
    [
      'sem transactionId (formato antigo)',
      { accountId: 'acc-1', type: 'DEPOSIT', amount: 10 },
    ],
    ['com transactionId que não é UUID', { transactionId: 'abc' }],
  ])(
    'deve recusar um job %s sem processar nem marcar transações como FAILED',
    async (_caso, data) => {
      let processor!: (job: unknown) => Promise<void>;
      (Worker as unknown as jest.Mock).mockImplementation(
        (_queue: string, fn: (job: unknown) => Promise<void>) => {
          processor = fn;
          return { on: jest.fn(), close: jest.fn() };
        },
      );
      jest.spyOn(Logger.prototype, 'log').mockImplementation();
      const service = { process: jest.fn(), markFailed: jest.fn() };
      new TransactionWorker(
        { getConnectionOptions: () => ({}) } as unknown as RedisService,
        service as unknown as TransactionsService,
      ).onModuleInit();

      await expect(
        processor({ id: '7', data, attemptsMade: 0, opts: { attempts: 3 } }),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(service.process).not.toHaveBeenCalled();
      expect(service.markFailed).not.toHaveBeenCalled();
    },
  );

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
        data: { transactionId: '6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d' },
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
        '6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d',
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
        '6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d',
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
        expect.stringMatching(
          /6f1c2b1e-8a4d-4f0e-9c3b-2d5e7a9b1c3d.*banco indisponível/,
        ),
        falhaAoMarcar.stack,
      );
    });
  });
});
