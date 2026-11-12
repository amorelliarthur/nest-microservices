import { generateKeyPairSync } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { InternalTokenVerifier } from '../internal-token.verifier';

// Par de chaves gerado na hora e um emissor igual ao do auth, só para testes
export const createInternalTokenTestKit = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const issue = (id: string, role = 'USER'): string =>
    sign({ role, email: `${id}@example.com` }, privateKey, {
      algorithm: 'ES256',
      subject: id,
      issuer: 'auth-service',
      audience: 'internal',
      expiresIn: 120,
    });

  // token com que o auth se identifica no login
  const issueService = (subject = 'auth-service'): string =>
    sign({}, privateKey, {
      algorithm: 'ES256',
      subject,
      issuer: 'auth-service',
      audience: 'user-service',
      expiresIn: 30,
    });

  const publicKeyBase64 = Buffer.from(
    publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  ).toString('base64');

  return {
    issue,
    issueService,
    publicKeyBase64,
    verifier: new InternalTokenVerifier(publicKey),
  };
};
