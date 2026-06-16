import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { CreateTransactionDto } from '../../transactions/dto/create-transaction.dto';

export const TRANSACTION_QUEUE = 'transactions';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor(private readonly redisService: RedisService) {
    this.queue = new Queue(TRANSACTION_QUEUE, {
      connection: this.redisService.getConnectionOptions(),
    });
  }

  async enqueueTransaction(dto: CreateTransactionDto): Promise<string> {
    const job = await this.queue.add('process-transaction', dto, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return job.id!;
  }

  onModuleDestroy() {
    this.queue.close();
  }
}
