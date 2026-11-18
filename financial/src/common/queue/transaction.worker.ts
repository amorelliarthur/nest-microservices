import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TRANSACTION_QUEUE } from './queue.service';
import type { TransactionJobData } from './queue.service';
import { toJobError } from './job-error';

@Injectable()
export class TransactionWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;
  private readonly logger = new Logger(TransactionWorker.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly transactionsService: TransactionsService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      TRANSACTION_QUEUE,
      async (job: Job<TransactionJobData>) => {
        const { transactionId } = job.data;
        this.logger.log(
          `Processing job ${job.id} (transaction ${transactionId})`,
        );
        try {
          await this.transactionsService.process(transactionId);
        } catch (error) {
          throw toJobError(error);
        }
        this.logger.log(`Job ${job.id} completed`);
      },
      { connection: this.redisService.getConnectionOptions() },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`, err.stack);
    });
  }

  onModuleDestroy() {
    void this.worker.close();
  }
}
