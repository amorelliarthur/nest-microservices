import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Controller()
export class TransactionConsumer {
  private readonly logger = new Logger(TransactionConsumer.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  @EventPattern('transaction.completed')
  async handleTransactionCompleted(
    @Payload()
    data: {
      userId: string;
      accountId: string;
      type: string;
      amount: number;
    },
  ) {
    this.logger.log(
      `transaction.completed received for user ${data.userId} (${data.type})`,
    );

    // atualiza lastTransactionAt do usuário
    await this.userModel.findByIdAndUpdate(data.userId, {
      lastTransactionAt: new Date(),
    });

    this.logger.log(`lastTransactionAt updated for user ${data.userId}`);
  }
}
