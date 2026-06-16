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

  async publish(pattern: string, data: any): Promise<void> {
    try {
      this.client.emit(pattern, data);
      console.log(`[RabbitMQ] evento publicado: ${pattern}`);
    } catch (err: any) {
      console.error('[RabbitMQ] erro ao publicar:', err.message);
    }
  }

  onModuleDestroy() {
    this.client.close();
  }
}
