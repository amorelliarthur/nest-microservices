import { generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

// Same options the auth service uses when issuing the internal token
export const internalTokenSignOptions = (id: string): SignOptions => ({
  algorithm: 'ES256',
  subject: id,
  issuer: 'auth-service',
  audience: 'internal',
  expiresIn: 120,
});

// Key pair generated on the fly plus an issuer that mirrors auth, for tests only
export const createInternalTokenTestKit = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const issue = (id: string, role = 'USER'): string =>
    sign(
      { role, email: `${id}@example.com` },
      privateKey,
      internalTokenSignOptions(id),
    );

  const toBase64 = (key: KeyObject, type: 'spki' | 'pkcs8') =>
    Buffer.from(key.export({ type, format: 'pem' }).toString()).toString(
      'base64',
    );

  return {
    issue,
    privateKey,
    publicKey,
    publicKeyBase64: toBase64(publicKey, 'spki'),
    privateKeyBase64: toBase64(privateKey, 'pkcs8'),
  };
};
