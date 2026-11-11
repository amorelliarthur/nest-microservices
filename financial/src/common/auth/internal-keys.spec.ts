import { generateKeyPairSync } from 'node:crypto';
import { loadInternalPublicKey } from './internal-keys';

const toBase64 = (pem: string) => Buffer.from(pem).toString('base64');

const generateEcKeyPair = () =>
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

describe('loadInternalPublicKey', () => {
  it('deve carregar uma chave pública EC P-256 em base64', () => {
    const { publicKey } = generateEcKeyPair();
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const key = loadInternalPublicKey(toBase64(pem));

    expect(key.type).toBe('public');
    expect(key.asymmetricKeyType).toBe('ec');
    expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
  });

  it('deve falhar quando a chave não está configurada', () => {
    expect(() => loadInternalPublicKey(undefined)).toThrow(
      'Missing INTERNAL_JWT_PUBLIC_KEY_B64',
    );
    expect(() => loadInternalPublicKey('   ')).toThrow(
      'Missing INTERNAL_JWT_PUBLIC_KEY_B64',
    );
  });

  it('deve falhar quando a chave não é um PEM válido', () => {
    expect(() => loadInternalPublicKey(toBase64('não é uma chave'))).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64',
    );
  });

  it('deve recusar uma chave privada, que só pode ficar no auth', () => {
    const { privateKey } = generateEcKeyPair();
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    expect(() => loadInternalPublicKey(toBase64(pem))).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64: expected a public key',
    );
  });

  it('deve falhar quando a chave não é EC P-256', () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    expect(() => loadInternalPublicKey(toBase64(pem))).toThrow(
      'Invalid INTERNAL_JWT_PUBLIC_KEY_B64: expected an EC P-256',
    );
  });

  it('não deve incluir o conteúdo da chave na mensagem de erro', () => {
    const { privateKey } = generateEcKeyPair();
    const base64 = toBase64(
      privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    );

    expect(() => loadInternalPublicKey(base64)).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(base64.slice(0, 20)) as string,
      }),
    );
  });
});
