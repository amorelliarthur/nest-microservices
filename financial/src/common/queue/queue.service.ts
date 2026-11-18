import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';

export const TRANSACTION_QUEUE = 'transactions';

// O job carrega só o id: os dados ficam na transação PENDING gravada no banco
export interface TransactionJobData {
  transactionId: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(private readonly redisService: RedisService) {
    this.queue = new Queue(TRANSACTION_QUEUE, {
      connection: this.redisService.getConnectionOptions(),
    });
  }

  async enqueueTransaction(transactionId: string): Promise<string> {
    const data: TransactionJobData = { transactionId };
    const job = await this.queue.add('process-transaction', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return job.id!;
  }

  onModuleDestroy() {
    void this.queue.close();
  }
}
