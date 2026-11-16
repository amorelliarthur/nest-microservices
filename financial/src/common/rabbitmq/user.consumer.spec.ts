import { ConflictException, Logger } from '@nestjs/common';
import { AccountsService } from '../../accounts/accounts.service';
import { UserConsumer } from './user.consumer';

describe('UserConsumer', () => {
  const data = { userId: 'user-1', nome: 'Ana', email: 'ana@example.com' };
  let create: jest.Mock;
  let consumer: UserConsumer;
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    create = jest.fn();
    consumer = new UserConsumer({ create } as unknown as AccountsService);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('deve registrar como erro uma falha inesperada ao criar a conta automática', async () => {
    create.mockRejectedValue(new Error('banco indisponível'));

    await expect(consumer.handleUserCreated(data)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('banco indisponível'),
      expect.any(String),
    );
  });

  it('deve registrar como aviso (e não como erro) quando a conta já existe', async () => {
    create.mockRejectedValue(
      new ConflictException('Usuário já possui uma conta deste tipo'),
    );

    await expect(consumer.handleUserCreated(data)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('user-1'));
    expect(error).not.toHaveBeenCalled();
  });
});
