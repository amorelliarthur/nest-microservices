import { InternalAuthModule } from '../common/auth/internal-auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { UserConsumer } from '../common/rabbitmq/user.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Account]), InternalAuthModule],
  controllers: [AccountsController, UserConsumer],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
