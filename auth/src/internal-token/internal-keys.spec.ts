import { generateKeyPairSync } from 'node:crypto';
import { loadInternalPrivateKey } from './internal-keys';

const toBase64 = (pem: string) => Buffer.from(pem).toString('base64');

describe('loadInternalPrivateKey', () => {
  it('deve carregar uma chave privada EC P-256 em base64', () => {
    const { privateKey } = generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const key = loadInternalPrivateKey(toBase64(pem));

    expect(key.asymmetricKeyType).toBe('ec');
    expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
  });

  it('deve falhar quando a chave não está configurada', () => {
    expect(() => loadInternalPrivateKey(undefined)).toThrow(
      'INTERNAL_JWT_PRIVATE_KEY_B64',
    );
  });

  it('deve falhar quando a chave não é um PEM válido', () => {
    expect(() => loadInternalPrivateKey(toBase64('não é uma chave'))).toThrow(
      'INTERNAL_JWT_PRIVATE_KEY_B64',
    );
  });

  it('deve falhar quando a chave não é EC P-256', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    expect(() => loadInternalPrivateKey(toBase64(pem))).toThrow(
      'INTERNAL_JWT_PRIVATE_KEY_B64',
    );
  });
});
