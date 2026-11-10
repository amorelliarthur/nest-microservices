import { createHash, timingSafeEqual } from 'node:crypto';

const ENV_NAME = 'GATEWAY_SHARED_SECRET';
const MIN_LENGTH = 32;

export const GATEWAY_SECRET_VERIFIER = Symbol('GATEWAY_SECRET_VERIFIER');

export type GatewaySecretVerifier = (
  received: string | string[] | undefined,
) => boolean;

// O hash deixa os dois lados com 32 bytes: o timingSafeEqual não lança erro
// com tamanhos diferentes e o tamanho do segredo não vaza pelo tempo.
const digest = (value: string) => createHash('sha256').update(value).digest();

// Segredo compartilhado só entre gateway e auth: protege a rota que emite
// o token interno. As mensagens de erro nunca incluem o segredo.
export const createGatewaySecretVerifier = (
  secret: string | undefined,
): GatewaySecretVerifier => {
  if (!secret || secret.trim() === '') {
    throw new Error(`Missing ${ENV_NAME}`);
  }
  if (secret.length < MIN_LENGTH) {
    throw new Error(
      `Invalid ${ENV_NAME}: expected at least ${MIN_LENGTH} characters`,
    );
  }

  const expected = digest(secret);

  return (received) => {
    // header ausente, vazio ou repetido (array) é recusado
    if (typeof received !== 'string' || received === '') return false;
    return timingSafeEqual(digest(received), expected);
  };
};
