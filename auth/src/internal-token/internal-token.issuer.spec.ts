import { generateKeyPairSync } from 'node:crypto';
import { verify } from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { InternalTokenIssuer } from './internal-token.issuer';

const keyPair = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const identity = { id: 'user-1', role: 'USER', email: 'ana@example.com' };

describe('InternalTokenIssuer', () => {
  it('deve emitir um token ES256 com a identidade do usuário, válido por 2 minutos', () => {
    const { privateKey, publicKey } = keyPair();

    const token = new InternalTokenIssuer(privateKey).issue(identity);
    const payload = verify(token, publicKey, {
      algorithms: ['ES256'],
      issuer: 'auth-service',
      audience: 'internal',
    }) as JwtPayload;

    expect(payload).toMatchObject({
      sub: 'user-1',
      role: 'USER',
      email: 'ana@example.com',
    });
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(120);
  });

  it('não deve ser aceito por quem verifica com outra chave pública', () => {
    const issuer = new InternalTokenIssuer(keyPair().privateKey);
    const token = issuer.issue(identity);

    expect(() =>
      verify(token, keyPair().publicKey, { algorithms: ['ES256'] }),
    ).toThrow('invalid signature');
  });
});
