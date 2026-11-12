import type { KeyObject } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import { INTERNAL_TOKEN_ISSUER } from './internal-token.issuer';

// Identifica o próprio auth (não um usuário) nas chamadas ao user-service.
// A audiência diferente impede que ele seja aceito como token interno de
// usuário, e que um token de usuário seja aceito no lugar dele.
export const SERVICE_TOKEN_SUBJECT = 'auth-service';
export const SERVICE_TOKEN_AUDIENCE = 'user-service';
const SERVICE_TOKEN_TTL_SECONDS = 30;

export class ServiceTokenIssuer {
  constructor(private readonly privateKey: KeyObject) {}

  issue(): string {
    return sign({}, this.privateKey, {
      algorithm: 'ES256',
      subject: SERVICE_TOKEN_SUBJECT,
      issuer: INTERNAL_TOKEN_ISSUER,
      audience: SERVICE_TOKEN_AUDIENCE,
      expiresIn: SERVICE_TOKEN_TTL_SECONDS,
    });
  }
}
