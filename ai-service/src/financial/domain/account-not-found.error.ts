// Mesma resposta para conta inexistente e conta de outro usuário: não revela quais ids existem
export class AccountNotFoundError extends Error {
  constructor(readonly accountId: string) {
    super(`Account ${accountId} not found`);
    this.name = 'AccountNotFoundError';
  }
}
