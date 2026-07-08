import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    // Carrega o .env globalmente para todos os módulos
    ConfigModule.forRoot({ isGlobal: true }),

    // Conexão com o MongoDB usando a variável de ambiente
    MongooseModule.forRoot(
      `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_NAME}`,
    ),

    UsersModule,
    MetricsModule,
  ],
})
export class AppModule {}
