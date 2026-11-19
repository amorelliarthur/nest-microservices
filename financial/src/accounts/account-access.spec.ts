import { NotFoundException } from '@nestjs/common';
import { assertAccountAccess } from './account-access';
import type { Account } from './entities/account.entity';

describe('assertAccountAccess()', () => {
  const conta = { id: 'acc-1', userId: 'user-1' } as Account;

  it('deve devolver a conta quando o usuário é o dono', () => {
    expect(assertAccountAccess(conta, { id: 'user-1', role: 'USER' })).toBe(
      conta,
    );
  });

  it('deve devolver a conta de outro usuário para ADMIN', () => {
    expect(assertAccountAccess(conta, { id: 'admin-1', role: 'ADMIN' })).toBe(
      conta,
    );
  });

  it('deve responder 404 "Conta não encontrada" quando a conta não existe', () => {
    const check = () =>
      assertAccountAccess(null, { id: 'user-1', role: 'USER' });

    expect(check).toThrow(NotFoundException);
    expect(check).toThrow('Conta não encontrada');
  });

  it('deve responder igual a uma inexistente quando a conta é de outro usuário', () => {
    const check = () =>
      assertAccountAccess(conta, { id: 'user-2', role: 'USER' });

    expect(check).toThrow(NotFoundException);
    expect(check).toThrow('Conta não encontrada');
  });

  it('deve usar a mensagem informada no 404', () => {
    const check = () =>
      assertAccountAccess(
        conta,
        { id: 'user-2', role: 'USER' },
        'Transação não encontrada',
      );

    expect(check).toThrow(NotFoundException);
    expect(check).toThrow('Transação não encontrada');
  });
});
