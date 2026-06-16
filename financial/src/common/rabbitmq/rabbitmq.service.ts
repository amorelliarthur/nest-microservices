import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private client!: ClientProxy;

  onModuleInit() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
        queue: 'transactions_queue',
        queueOptions: { durable: true },
      },
    });
  }

  async publish(pattern: string, data: unknown): Promise<void> {
    await Promise.resolve();

    try {
      this.client.emit(pattern, data);
      console.log(`[RabbitMQ] evento publicado: ${pattern}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      console.error('[RabbitMQ] erro ao publicar:', message);
    }
  }

  onModuleDestroy() {
    this.client.close();
  }
}
