import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker, Job, UnrecoverableError } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { TransactionsService } from '../../transactions/transactions.service';
import { TRANSACTION_QUEUE } from './queue.service';
import type { TransactionJobData } from './queue.service';
import { toFailureReason, toJobError } from './job-error';

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
          const jobError = toJobError(error);
          if (this.isLastAttempt(job, jobError)) {
            await this.markFailed(transactionId, toFailureReason(error));
          }
          throw jobError;
        }
        this.logger.log(`Job ${job.id} completed`);
      },
      { connection: this.redisService.getConnectionOptions() },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`, err.stack);
    });
  }

  // Mesma regra do BullMQ para decidir se o job será repetido
  private isLastAttempt(job: Job, jobError: unknown): boolean {
    return (
      jobError instanceof UnrecoverableError ||
      job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
    );
  }

  // Uma falha ao gravar o FAILED não pode esconder a falha original do job
  private async markFailed(transactionId: string, reason: string) {
    try {
      await this.transactionsService.markFailed(transactionId, reason);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Could not mark transaction ${transactionId} as FAILED: ${error.message}`,
        error.stack,
      );
    }
  }

  onModuleDestroy() {
    void this.worker.close();
  }
}
