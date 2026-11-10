const ENV_NAME = 'GATEWAY_SHARED_SECRET';
const MIN_LENGTH = 32;

// token de injeção do segredo compartilhado entre gateway e auth
export const GATEWAY_SECRET = 'GATEWAY_SHARED_SECRET';

// Mesmas regras do auth. As mensagens de erro nunca incluem o segredo.
export const loadGatewaySecret = (secret: string | undefined): string => {
  if (!secret || secret.trim() === '') {
    throw new Error(`Missing ${ENV_NAME}`);
  }
  if (secret.length < MIN_LENGTH) {
    throw new Error(
      `Invalid ${ENV_NAME}: expected at least ${MIN_LENGTH} characters`,
    );
  }
  return secret;
};
