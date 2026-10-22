import { NotFoundException } from '@nestjs/common';
import { canAccess } from '../common/auth/requester';
import type { Requester } from '../common/auth/requester';
import type { Account } from './entities/account.entity';

// Mesma resposta para conta inexistente e conta de outro usuário: não revela quais ids existem
export const assertAccountAccess = (
  account: Account | null,
  requester: Requester,
): Account => {
  if (!account || !canAccess(requester, account.userId)) {
    throw new NotFoundException('Conta não encontrada');
  }
  return account;
};
