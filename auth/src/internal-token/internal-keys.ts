import { createPrivateKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

const ENV_NAME = 'INTERNAL_JWT_PRIVATE_KEY_B64';
const EXPECTED_CURVE = 'prime256v1';

// Carrega a chave privada ES256 (PEM em base64) que assina o token interno.
// As mensagens de erro nunca incluem o conteúdo da chave.
export const loadInternalPrivateKey = (
  base64: string | undefined,
): KeyObject => {
  if (!base64 || base64.trim() === '') {
    throw new Error(
      `Missing ${ENV_NAME}: generate it with scripts/generate-internal-keys.sh`,
    );
  }

  let key: KeyObject;
  try {
    key = createPrivateKey(Buffer.from(base64.trim(), 'base64'));
  } catch {
    throw new Error(
      `Invalid ${ENV_NAME}: expected a base64-encoded PEM private key`,
    );
  }

  if (
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== EXPECTED_CURVE
  ) {
    throw new Error(
      `Invalid ${ENV_NAME}: expected an EC P-256 (${EXPECTED_CURVE}) private key`,
    );
  }

  return key;
};
