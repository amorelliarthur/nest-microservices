import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { CreateTransactionDto } from '../../transactions/dto/create-transaction.dto';
import { TRANSACTION_QUEUE } from './queue.service';
import { toJobError } from './job-error';

@Injectable()
export class TransactionWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;

  constructor(
    private readonly redisService: RedisService,
    private readonly transactionsService: TransactionsService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      TRANSACTION_QUEUE,
      async (job: Job<CreateTransactionDto>) => {
        console.log(
          `[Queue] processando job ${job.id} — tipo: ${job.data.type}`,
        );
        try {
          await this.transactionsService.process(job.data);
        } catch (error) {
          throw toJobError(error);
        }
        console.log(`[Queue] job ${job.id} concluído`);
      },
      { connection: this.redisService.getConnectionOptions() },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[Queue] job ${job?.id} falhou:`, err.message);
    });
  }

  onModuleDestroy() {
    void this.worker.close();
  }
}
