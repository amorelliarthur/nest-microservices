import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { InternalTokenVerifier } from './internal-token.verifier';
import {
  createInternalTokenTestKit,
  internalTokenSignOptions,
} from './testing/internal-token.testing';

describe('InternalTokenVerifier', () => {
  const kit = createInternalTokenTestKit();
  const verifier = new InternalTokenVerifier(kit.publicKey);
  const validOptions = internalTokenSignOptions('user-1');

  const issue = (
    payload: object = { role: 'USER', email: 'ana@example.com' },
    options: SignOptions = validOptions,
    key: KeyObject | string = kit.privateKey,
  ) => sign(payload, key, options);

  it('returns the id and role of a valid token', () => {
    expect(verifier.verify(issue())).toEqual({ id: 'user-1', role: 'USER' });
  });

  it('keeps the ADMIN role', () => {
    expect(verifier.verify(kit.issue('admin-1', 'ADMIN'))).toEqual({
      id: 'admin-1',
      role: 'ADMIN',
    });
  });

  it.each([undefined, '', '   ', ['a', 'b']])(
    'rejects a missing or non-string token (%p)',
    (token) => {
      expect(verifier.verify(token)).toBeNull();
    },
  );

  it('rejects a value that is not a JWT', () => {
    expect(verifier.verify('not-a-jwt')).toBeNull();
  });

  it('rejects a token signed with another key', () => {
    const otherKey = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    }).privateKey;

    expect(
      verifier.verify(issue(undefined, validOptions, otherKey)),
    ).toBeNull();
  });

  it('rejects an HS256 token that uses the public key as the secret', () => {
    const publicPem = kit.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    const token = issue(
      undefined,
      { ...validOptions, algorithm: 'HS256' },
      publicPem,
    );

    expect(verifier.verify(token)).toBeNull();
  });

  it('rejects an unsigned token (alg none)', () => {
    const token = sign({ role: 'ADMIN' }, '', {
      ...validOptions,
      algorithm: 'none',
    });

    expect(verifier.verify(token)).toBeNull();
  });

  it('rejects a token from another issuer', () => {
    expect(
      verifier.verify(issue(undefined, { ...validOptions, issuer: 'other' })),
    ).toBeNull();
  });

  it('rejects a token for another audience', () => {
    expect(
      verifier.verify(
        issue(undefined, { ...validOptions, audience: 'client' }),
      ),
    ).toBeNull();
  });

  it('rejects an expired token', () => {
    const now = Math.floor(Date.now() / 1000);
    const { expiresIn: _ignored, ...withoutExpiresIn } = validOptions;
    const token = issue(
      { role: 'USER', iat: now - 300, exp: now - 180 },
      withoutExpiresIn,
    );

    expect(verifier.verify(token)).toBeNull();
  });

  it('rejects a token without a subject', () => {
    const { subject: _ignored, ...withoutSubject } = validOptions;

    expect(verifier.verify(issue(undefined, withoutSubject))).toBeNull();
  });

  it.each([{ email: 'ana@example.com' }, { role: '' }, { role: 42 }])(
    'rejects a token without a valid role (%p)',
    (payload) => {
      expect(verifier.verify(issue(payload))).toBeNull();
    },
  );
});
