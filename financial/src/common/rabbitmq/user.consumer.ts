import { ConflictException, Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AccountsService } from '../../accounts/accounts.service';
import { AccountType } from '../../accounts/entities/account.entity';

@Controller()
export class UserConsumer {
  private readonly logger = new Logger(UserConsumer.name);

  constructor(private readonly accountsService: AccountsService) {}

  @EventPattern('user.created')
  async handleUserCreated(
    @Payload() data: { userId: string; nome: string; email: string },
  ) {
    this.logger.log(`user.created received for user ${data.userId}`);

    try {
      await this.accountsService.create({
        userId: data.userId,
        type: AccountType.CHECKING,
      });

      this.logger.log(`CHECKING account created for user ${data.userId}`);
    } catch (err: unknown) {
      // nenhum erro pode quebrar o consumer; conta já existente é esperado
      if (err instanceof ConflictException) {
        this.logger.warn(
          `CHECKING account already exists for user ${data.userId}`,
        );
        return;
      }
      const message = err instanceof Error ? err.message : 'unknown error';
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Failed to create CHECKING account for user ${data.userId}: ${message}`,
        stack,
      );
    }
  }
}
