import { NotFoundException } from '@nestjs/common';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';
import type { Account } from './entities/account.entity';

// Mesma resposta para conta inexistente e conta de outro usuário: não revela quais ids existem.
// Quem protege outro recurso pela conta (ex.: uma transação) informa a própria mensagem.
export const assertAccountAccess = (
  account: Account | null,
  requester: Requester,
  notFoundMessage = 'Conta não encontrada',
): Account => {
  if (!account || !canAccess(requester, account.userId)) {
    throw new NotFoundException(notFoundMessage);
  }
  return account;
};
