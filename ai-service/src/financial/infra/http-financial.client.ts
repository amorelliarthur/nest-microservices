import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { formatZodIssues } from '../../shared/zod/format-zod-issues';
import type { FinancialClient } from '../domain/financial-client.port';
import { FinancialServiceError } from '../domain/financial-service.error';
import type {
  FinancialAccount,
  FinancialTransaction,
} from '../domain/financial.types';
import {
  accountResponseSchema,
  transactionResponseSchema,
} from './financial-response.schemas';

const DEFAULT_TIMEOUT_MS = 3000;

@Injectable()
export class HttpFinancialClient implements FinancialClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.getOrThrow<string>('FINANCIAL_SERVER');
    this.timeoutMs = Number(
      config.get<string>('FINANCIAL_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS,
    );
  }

  listAccounts(userId: string): Promise<FinancialAccount[]> {
    return this.get(
      `/accounts/user/${encodeURIComponent(userId)}`,
      userId,
      z.array(accountResponseSchema),
    );
  }

  listTransactions(
    userId: string,
    accountId: string,
  ): Promise<FinancialTransaction[]> {
    // accountId vem do modelo: codificar impede que ele altere o caminho da URL
    return this.get(
      `/transactions/account/${encodeURIComponent(accountId)}`,
      userId,
      z.array(transactionResponseSchema),
    );
  }

  private async get<T>(
    path: string,
    userId: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: { 'x-user-id': userId },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new FinancialServiceError(
        error instanceof Error ? error.message : 'request failed',
      );
    }

    if (!response.ok) {
      throw new FinancialServiceError(`HTTP ${response.status}`);
    }

    const result = schema.safeParse(await response.json());
    if (!result.success) {
      throw new FinancialServiceError(
        `unexpected response: ${formatZodIssues(result.error).join('; ')}`,
      );
    }
    return result.data;
  }
}
