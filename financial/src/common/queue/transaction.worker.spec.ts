import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
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
});
