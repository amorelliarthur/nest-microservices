import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AccountsService } from '../../accounts/accounts.service';
import { AccountType } from '../../accounts/entities/account.entity';

@Controller()
export class UserConsumer {
  constructor(private readonly accountsService: AccountsService) {}

  @EventPattern('user.created')
  async handleUserCreated(
    @Payload() data: { userId: string; nome: string; email: string },
  ) {
    console.log(`[RabbitMQ] evento recebido — novo usuário: ${data.userId}`);

    try {
      await this.accountsService.create({
        userId: data.userId,
        type: AccountType.CHECKING,
      });

      console.log(
        `[RabbitMQ] conta CHECKING criada automaticamente para userId: ${data.userId}`,
      );
    } catch (err: unknown) {
      // ConflictException se já existir conta — não deve quebrar o consumer
      const message = err instanceof Error ? err.message : 'erro desconhecido';
      console.error('[RabbitMQ] erro ao criar conta automática:', message);
    }
  }
}
