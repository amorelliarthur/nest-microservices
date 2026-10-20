import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AssistantModule } from './assistant/assistant.module';
import { UserContextGuard } from './shared/auth/user-context.guard';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TransactionsModule,
    AssistantModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserContextGuard }],
})
export class AppModule {}
