import { HttpException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

// Falha de regra de negócio (4xx) é definitiva: repetir não resolve e pode
// executar depois uma transação que deveria ter sido recusada.
// Qualquer outro erro (banco, rede) é tratado como temporário e repetido.
export const toJobError = (error: unknown): unknown => {
  if (error instanceof HttpException && error.getStatus() < 500) {
    return new UnrecoverableError(error.message);
  }
  return error;
};
