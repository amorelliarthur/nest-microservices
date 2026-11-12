import { generateKeyPairSync } from 'node:crypto';
import { verify } from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { ServiceTokenIssuer } from './service-token.issuer';

const keyPair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

describe('ServiceTokenIssuer', () => {
  it('deve emitir um token ES256 que identifica o auth para o user, válido por 30 segundos', () => {
    const { privateKey, publicKey } = keyPair();

    const token = new ServiceTokenIssuer(privateKey).issue();
    const payload = verify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: 'auth-service',
      audience: 'user-service',
      subject: 'auth-service',
    }) as JwtPayload;

    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(30);
  });

  it('não deve ser aceito como token interno de usuário', () => {
    const { privateKey, publicKey } = keyPair();

    const token = new ServiceTokenIssuer(privateKey).issue();

    expect(() =>
      verify(token, publicKey, {
        algorithms: ['ES256'],
        issuer: 'auth-service',
        audience: 'internal',
      }),
    ).toThrow('jwt audience invalid');
  });
});
