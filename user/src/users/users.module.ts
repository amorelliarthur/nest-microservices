import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerOrAdminGuard } from '../common/guards/owner-or-admin.guard';
import { RedisService } from '../common/redis/redis.service';
import { TransactionConsumer } from '../common/rabbitmq/transaction.consumer';


@Module({
    imports: [
        // Registra o schema do Mongoose dentro deste módulo
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
    controllers: [UsersController, TransactionConsumer],
    providers: [UsersService, AdminGuard, OwnerOrAdminGuard, RedisService],
    exports: [UsersService], // exporta para uso em outros módulos se necessário
})
export class UsersModule { }