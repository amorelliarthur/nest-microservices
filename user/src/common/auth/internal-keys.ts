import { createPrivateKey, createPublicKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

const ENV_NAME = 'INTERNAL_JWT_PUBLIC_KEY_B64';
const EXPECTED_CURVE = 'prime256v1';

const isPrivateKey = (pem: Buffer): boolean => {
  try {
    createPrivateKey(pem);
    return true;
  } catch {
    return false;
  }
};

// Carrega a chave pública ES256 (PEM em base64) que verifica o token interno.
// As mensagens de erro nunca incluem o conteúdo da chave.
export const loadInternalPublicKey = (
  base64: string | undefined,
): KeyObject => {
  if (!base64 || base64.trim() === '') {
    throw new Error(
      `Missing ${ENV_NAME}: generate it with scripts/generate-internal-keys.sh`,
    );
  }

  const pem = Buffer.from(base64.trim(), 'base64');

  // createPublicKey aceita um PEM privado e deriva a chave pública dele;
  // recusamos para a chave privada não se espalhar pelos .env dos serviços.
  if (isPrivateKey(pem)) {
    throw new Error(
      `Invalid ${ENV_NAME}: expected a public key, the private key belongs only to the auth service`,
    );
  }

  let key: KeyObject;
  try {
    key = createPublicKey(pem);
  } catch {
    throw new Error(
      `Invalid ${ENV_NAME}: expected a base64-encoded PEM public key`,
    );
  }

  if (
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== EXPECTED_CURVE
  ) {
    throw new Error(
      `Invalid ${ENV_NAME}: expected an EC P-256 (${EXPECTED_CURVE}) public key`,
    );
  }

  return key;
};
