import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private client!: ClientProxy;
  private readonly logger = new Logger(RabbitMQService.name);

  onModuleInit() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${process.env.RABBITMQ_HOST || 'localhost'}:5672`],
        queue: 'users_queue',
        queueOptions: { durable: true },
      },
    });
  }

  async publish(pattern: string, data: unknown): Promise<void> {
    try {
      // o emit devolve um Observable: as falhas só aparecem ao esperar por ele
      await lastValueFrom(this.client.emit(pattern, data), {
        defaultValue: undefined,
      });
      this.logger.log(`Event published: ${pattern}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Failed to publish ${pattern}: ${message}`, stack);
    }
  }

  onModuleDestroy() {
    this.client.close();
  }
}
