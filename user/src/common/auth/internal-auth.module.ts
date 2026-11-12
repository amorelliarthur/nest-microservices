import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { loadInternalPublicKey } from './internal-keys';
import { InternalTokenGuard } from './internal-token.guard';
import { InternalTokenVerifier } from './internal-token.verifier';
import { ServiceTokenGuard } from './service-token.guard';

@Module({
  providers: [
    {
      provide: InternalTokenVerifier,
      inject: [ConfigService],
      // sem a chave pública válida o serviço não sobe
      useFactory: (config: ConfigService) =>
        new InternalTokenVerifier(
          loadInternalPublicKey(
            config.get<string>('INTERNAL_JWT_PUBLIC_KEY_B64'),
          ),
        ),
    },
    InternalTokenGuard,
    ServiceTokenGuard,
  ],
  exports: [InternalTokenVerifier, InternalTokenGuard, ServiceTokenGuard],
})
export class InternalAuthModule {}
