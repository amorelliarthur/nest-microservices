import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

@Controller()
export class TransactionConsumer {
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
    console.log(
      `[RabbitMQ] evento recebido — userId: ${data.userId} | tipo: ${data.type}`,
    );

    // atualiza lastTransactionAt do usuário
    await this.userModel.findByIdAndUpdate(data.userId, {
      lastTransactionAt: new Date(),
    });

    console.log(
      `[RabbitMQ] lastTransactionAt atualizado para userId: ${data.userId}`,
    );
  }
}
