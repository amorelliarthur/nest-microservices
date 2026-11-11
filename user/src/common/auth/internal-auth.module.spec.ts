import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { InternalAuthModule } from './internal-auth.module';
import { InternalTokenVerifier } from './internal-token.verifier';
import { createInternalTokenTestKit } from './testing/internal-token.testing';

const compileWith = (env: Record<string, string>) =>
  Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => env],
      }),
      InternalAuthModule,
    ],
  }).compile();

describe('InternalAuthModule', () => {
  it('deve montar o verifier com a chave pública do ambiente', async () => {
    const tokens = createInternalTokenTestKit();

    const moduleRef = await compileWith({
      INTERNAL_JWT_PUBLIC_KEY_B64: tokens.publicKeyBase64,
    });
    const verifier = moduleRef.get(InternalTokenVerifier);

    expect(verifier.verify(tokens.issue('user-1'))).toEqual({
      id: 'user-1',
      role: 'USER',
    });
  });

  it('deve impedir o serviço de subir sem a chave pública', async () => {
    await expect(compileWith({})).rejects.toThrow(
      'Missing INTERNAL_JWT_PUBLIC_KEY_B64',
    );
  });
});
