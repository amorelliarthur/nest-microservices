import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';

// Bem acima do tempo das 3 tentativas com backoff: só encerra transações que
// nenhum worker vai concluir (job travado, perdido no Redis ou FAILED que não
// chegou a ser gravado)
export const STALE_PENDING_AFTER_MS = 10 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 60 * 1000;

// Roda em todas as instâncias: o UPDATE só altera PENDING, então varreduras
// simultâneas não conflitam
@Injectable()
export class StalePendingSweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StalePendingSweeper.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly transactionsService: TransactionsService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // Nunca lança: um erro aqui derrubaria o processo pelo setInterval
  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const count = await this.transactionsService.failStalePending(
        STALE_PENDING_AFTER_MS,
      );
      if (count > 0) {
        this.logger.warn(
          `Marked ${count} stale PENDING transaction(s) as FAILED (pending for more than ${STALE_PENDING_AFTER_MS / 60000} minutes)`,
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Could not fail stale PENDING transactions: ${error.message}`,
        error.stack,
      );
    } finally {
      this.running = false;
    }
  }
}
