import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from '../common/redis/redis.service';
import { StringValue } from 'ms';

@Module({
    imports: [
        // HttpModule para chamar o user-service
        HttpModule,

        // JwtModule configurado de forma assíncrona para ler o .env
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const secret = config.get<string>('CHAVE_PRIVADA');
                const expiresIn = config.get<string>('TEMPO_EXP');

                if (!secret || !expiresIn) {
                    throw new Error('Variáveis de ambiente JWT não definidas');
                }

                return {
                    secret,
                    signOptions: {
                        expiresIn: expiresIn as StringValue,
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, RedisService],
})
export class AuthModule { }