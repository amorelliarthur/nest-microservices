import { Logger } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { RabbitMQService } from './rabbitmq.service';

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let emit: jest.Mock;

  beforeEach(() => {
    emit = jest.fn();
    jest
      .spyOn(ClientProxyFactory, 'create')
      .mockReturnValue({ emit, close: jest.fn() } as unknown as ClientProxy);

    service = new RabbitMQService();
    service.onModuleInit();
  });

  afterEach(() => jest.restoreAllMocks());

  it('deve registrar a falha ao publicar como erro no Logger, com o contexto do serviço', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    emit.mockImplementation(() => {
      throw new Error('canal fechado');
    });

    await service.publish('evento.teste', {});

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('canal fechado'),
      expect.any(String),
    );
    expect(error.mock.contexts[0]).toMatchObject({
      context: RabbitMQService.name,
    });
  });
});
