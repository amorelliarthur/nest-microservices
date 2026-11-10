import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { InternalAuthController } from './internal-auth.controller';
import { AuthService } from './auth.service';
import { RedisService } from '../common/redis/redis.service';
import { StringValue } from 'ms';
import { InternalTokenIssuer } from '../internal-token/internal-token.issuer';
import { loadInternalPrivateKey } from '../internal-token/internal-keys';
import {
  GATEWAY_SECRET_VERIFIER,
  createGatewaySecretVerifier,
} from '../internal-token/gateway-secret';
import { GatewaySecretGuard } from '../internal-token/gateway-secret.guard';

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
  controllers: [AuthController, InternalAuthController],
  providers: [
    AuthService,
    RedisService,
    {
      // fail fast: sem uma chave válida, o auth não sobe
      provide: InternalTokenIssuer,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new InternalTokenIssuer(
          loadInternalPrivateKey(
            config.get<string>('INTERNAL_JWT_PRIVATE_KEY_B64'),
          ),
        ),
    },
    {
      // fail fast: sem o segredo do gateway, o auth não sobe
      provide: GATEWAY_SECRET_VERIFIER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createGatewaySecretVerifier(
          config.get<string>('GATEWAY_SHARED_SECRET'),
        ),
    },
    GatewaySecretGuard,
  ],
})
export class AuthModule {}
