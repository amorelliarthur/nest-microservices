import { Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { RabbitMQService } from './rabbitmq.service';

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let emit: jest.Mock;
  let log: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    emit = jest.fn();
    jest
      .spyOn(ClientProxyFactory, 'create')
      .mockReturnValue({ emit, close: jest.fn() } as unknown as ClientProxy);
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    service = new RabbitMQService();
    service.onModuleInit();
  });

  afterEach(() => jest.restoreAllMocks());

  it('deve registrar o evento como publicado quando o emit conclui', async () => {
    emit.mockReturnValue(of(undefined));

    await service.publish('evento.teste', {});

    expect(log).toHaveBeenCalledWith('Event published: evento.teste');
    expect(error).not.toHaveBeenCalled();
  });

  it('deve registrar como erro, com o contexto do serviço, quando o emit falha', async () => {
    emit.mockReturnValue(throwError(() => new Error('canal fechado')));

    await expect(service.publish('evento.teste', {})).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('canal fechado'),
      expect.any(String),
    );
    expect(error.mock.contexts[0]).toMatchObject({
      context: RabbitMQService.name,
    });
    expect(log).not.toHaveBeenCalledWith('Event published: evento.teste');
  });
});
