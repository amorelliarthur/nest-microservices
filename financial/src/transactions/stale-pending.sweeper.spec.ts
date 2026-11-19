import { Logger } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import {
  StalePendingSweeper,
  STALE_PENDING_AFTER_MS,
  SWEEP_INTERVAL_MS,
} from './stale-pending.sweeper';

describe('StalePendingSweeper', () => {
  const now = new Date('2026-11-19T12:00:00.000Z');

  const setup = () => {
    const service = { failStalePending: jest.fn().mockResolvedValue(0) };
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const sweeper = new StalePendingSweeper(
      service as unknown as TransactionsService,
    );
    return { sweeper, service, warn, error };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('deve usar prazo de 10 minutos e varrer a cada minuto', () => {
    expect(STALE_PENDING_AFTER_MS).toBe(10 * 60 * 1000);
    expect(SWEEP_INTERVAL_MS).toBe(60 * 1000);
  });

  it('deve encerrar as PENDING criadas há mais de 10 minutos', async () => {
    const { sweeper, service } = setup();

    await sweeper.sweep(now);

    expect(service.failStalePending).toHaveBeenCalledWith(
      new Date('2026-11-19T11:50:00.000Z'),
    );
  });

  it('deve registrar um aviso com a quantidade de transações encerradas', async () => {
    const { sweeper, service, warn } = setup();
    service.failStalePending.mockResolvedValue(2);

    await sweeper.sweep(now);

    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/2 .*PENDING.*FAILED/),
    );
  });

  it('não deve registrar aviso quando nenhuma transação é encerrada', async () => {
    const { sweeper, warn } = setup();

    await sweeper.sweep(now);

    expect(warn).not.toHaveBeenCalled();
  });

  it('deve registrar o erro sem lançar quando a varredura falha', async () => {
    const { sweeper, service, error } = setup();
    const falha = new Error('banco indisponível');
    service.failStalePending.mockRejectedValue(falha);

    await expect(sweeper.sweep(now)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/banco indisponível/),
      falha.stack,
    );
  });

  it('não deve iniciar uma nova varredura enquanto a anterior não terminou', async () => {
    const { sweeper, service } = setup();
    let terminar!: (count: number) => void;
    service.failStalePending.mockReturnValueOnce(
      new Promise<number>((resolve) => (terminar = resolve)),
    );

    const primeira = sweeper.sweep(now);
    await sweeper.sweep(now);
    terminar(0);
    await primeira;

    expect(service.failStalePending).toHaveBeenCalledTimes(1);
  });

  it('deve varrer a cada minuto depois de iniciar e parar ao destruir o módulo', async () => {
    jest.useFakeTimers({ now });
    const { sweeper, service } = setup();

    sweeper.onModuleInit();
    expect(service.failStalePending).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(service.failStalePending).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(service.failStalePending).toHaveBeenCalledTimes(2);

    sweeper.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 3);
    expect(service.failStalePending).toHaveBeenCalledTimes(2);
  });
});
