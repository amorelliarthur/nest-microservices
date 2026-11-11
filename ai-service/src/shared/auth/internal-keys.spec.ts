import { generateKeyPairSync } from 'node:crypto';
import { loadInternalPublicKey } from './internal-keys';
import { createInternalTokenTestKit } from './testing/internal-token.testing';

const toBase64 = (pem: string) => Buffer.from(pem).toString('base64');

describe('loadInternalPublicKey', () => {
  it('loads a base64-encoded EC P-256 public key', () => {
    const { publicKeyBase64 } = createInternalTokenTestKit();

    const key = loadInternalPublicKey(publicKeyBase64);

    expect(key.type).toBe('public');
    expect(key.asymmetricKeyType).toBe('ec');
    expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
  });

  it.each([undefined, '', '   '])(
    'fails when the key is missing (%p)',
    (value) => {
      expect(() => loadInternalPublicKey(value)).toThrow(
        'Missing INTERNAL_JWT_PUBLIC_KEY_B64',
      );
    },
  );

  it('fails when the value is not a PEM key', () => {
    expect(() => loadInternalPublicKey(toBase64('not a key'))).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64',
    );
  });

  it('rejects a private key, which must stay in the auth service only', () => {
    const { privateKeyBase64 } = createInternalTokenTestKit();

    expect(() => loadInternalPublicKey(privateKeyBase64)).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64: expected a public key',
    );
  });

  it('fails when the key is not EC P-256', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    expect(() => loadInternalPublicKey(toBase64(pem))).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64: expected an EC P-256',
    );
  });

  it('never includes the key content in the error message', () => {
    const { privateKeyBase64 } = createInternalTokenTestKit();

    expect(() => loadInternalPublicKey(privateKeyBase64)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(
          privateKeyBase64.slice(0, 20),
        ) as string,
      }),
    );
  });
});
