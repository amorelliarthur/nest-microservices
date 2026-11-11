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
  it('builds the verifier from the public key in the environment', async () => {
    const kit = createInternalTokenTestKit();

    const moduleRef = await compileWith({
      INTERNAL_JWT_PUBLIC_KEY_B64: kit.publicKeyBase64,
    });

    expect(
      moduleRef.get(InternalTokenVerifier).verify(kit.issue('user-1')),
    ).toEqual({ id: 'user-1', role: 'USER' });
  });

  it('prevents the service from starting without the public key', async () => {
    await expect(compileWith({})).rejects.toThrow(
      'Missing INTERNAL_JWT_PUBLIC_KEY_B64',
    );
  });
});
