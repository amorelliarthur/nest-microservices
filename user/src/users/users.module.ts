import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { OwnerOrAdminGuard } from '../common/guards/owner-or-admin.guard';

@Module({
    imports: [
        // Registra o schema do Mongoose dentro deste módulo
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        HttpModule,
    ],
    controllers: [UsersController],
    providers: [UsersService, AuthGuard, AdminGuard, OwnerOrAdminGuard],
    exports: [UsersService], // exporta para uso em outros módulos se necessário
})
export class UsersModule { }