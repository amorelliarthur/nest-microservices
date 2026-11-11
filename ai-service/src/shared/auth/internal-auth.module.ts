import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { loadInternalPublicKey } from './internal-keys';
import { InternalTokenVerifier } from './internal-token.verifier';

@Module({
  providers: [
    {
      provide: InternalTokenVerifier,
      inject: [ConfigService],
      // Without a valid public key the service does not start
      useFactory: (config: ConfigService) =>
        new InternalTokenVerifier(
          loadInternalPublicKey(
            config.get<string>('INTERNAL_JWT_PUBLIC_KEY_B64'),
          ),
        ),
    },
  ],
  exports: [InternalTokenVerifier],
})
export class InternalAuthModule {}
