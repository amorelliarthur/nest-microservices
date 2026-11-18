import { HttpException } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

// Mensagem exibida ao usuário quando a falha não é uma regra de negócio
export const GENERIC_FAILURE_REASON = 'Não foi possível processar a transação';

const isBusinessRuleError = (error: unknown): error is HttpException =>
  error instanceof HttpException && error.getStatus() < 500;

// Falha de regra de negócio (4xx) é definitiva: repetir não resolve e pode
// executar depois uma transação que deveria ter sido recusada.
// Qualquer outro erro (banco, rede) é tratado como temporário e repetido.
export const toJobError = (error: unknown): unknown => {
  if (isBusinessRuleError(error)) {
    return new UnrecoverableError(error.message);
  }
  return error;
};

// Motivo gravado na transação FAILED: regras de negócio são explicadas ao
// usuário; erros técnicos (banco, rede) não expõem detalhes internos
export const toFailureReason = (error: unknown): string =>
  isBusinessRuleError(error) ? error.message : GENERIC_FAILURE_REASON;
