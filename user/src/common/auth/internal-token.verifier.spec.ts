import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { InternalTokenVerifier } from './internal-token.verifier';

const generateEcKeyPair = () =>
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

// mesmas opções usadas pelo auth ao emitir o token interno
const validOptions: SignOptions = {
  algorithm: 'ES256',
  subject: 'user-1',
  issuer: 'auth-service',
  audience: 'internal',
  expiresIn: 120,
};

describe('InternalTokenVerifier', () => {
  const { privateKey, publicKey } = generateEcKeyPair();
  const verifier = new InternalTokenVerifier(publicKey);

  const issue = (
    payload: object = { role: 'USER', email: 'ana@example.com' },
    options: SignOptions = validOptions,
    key: KeyObject | string = privateKey,
  ) => sign(payload, key, options);

  it('deve devolver o id e a role de um token válido', () => {
    expect(verifier.verify(issue())).toEqual({ id: 'user-1', role: 'USER' });
  });

  it('deve preservar a role ADMIN', () => {
    const token = issue({ role: 'ADMIN', email: 'admin@example.com' });

    expect(verifier.verify(token)).toEqual({ id: 'user-1', role: 'ADMIN' });
  });

  it.each([undefined, '', '   ', ['a', 'b']])(
    'deve recusar quando o token está ausente ou não é texto (%p)',
    (token) => {
      expect(verifier.verify(token)).toBeNull();
    },
  );

  it('deve recusar um texto que não é JWT', () => {
    expect(verifier.verify('não-é-um-jwt')).toBeNull();
  });

  it('deve recusar um token assinado com outra chave', () => {
    const otherKey = generateEcKeyPair().privateKey;

    expect(
      verifier.verify(issue(undefined, validOptions, otherKey)),
    ).toBeNull();
  });

  it('deve recusar um token HS256, mesmo que use a chave pública como segredo', () => {
    const publicPem = publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const token = issue(
      undefined,
      { ...validOptions, algorithm: 'HS256' },
      publicPem,
    );

    expect(verifier.verify(token)).toBeNull();
  });

  it('deve recusar um token sem assinatura (alg none)', () => {
    const token = sign({ role: 'ADMIN' }, '', {
      ...validOptions,
      algorithm: 'none',
    });

    expect(verifier.verify(token)).toBeNull();
  });

  it('deve recusar um token de outro emissor', () => {
    const token = issue(undefined, { ...validOptions, issuer: 'outro' });

    expect(verifier.verify(token)).toBeNull();
  });

  it('deve recusar um token de outra audiência', () => {
    const token = issue(undefined, { ...validOptions, audience: 'cliente' });

    expect(verifier.verify(token)).toBeNull();
  });

  it('deve recusar um token expirado', () => {
    const now = Math.floor(Date.now() / 1000);
    const { expiresIn: _ignored, ...withoutExpiresIn } = validOptions;
    const token = issue(
      { role: 'USER', iat: now - 300, exp: now - 180 },
      withoutExpiresIn,
    );

    expect(verifier.verify(token)).toBeNull();
  });

  it('deve recusar um token sem subject', () => {
    const { subject: _ignored, ...withoutSubject } = validOptions;

    expect(verifier.verify(issue(undefined, withoutSubject))).toBeNull();
  });

  it.each([{ email: 'ana@example.com' }, { role: '' }, { role: 42 }])(
    'deve recusar um token sem role válida (%p)',
    (payload) => {
      expect(verifier.verify(issue(payload))).toBeNull();
    },
  );
});
