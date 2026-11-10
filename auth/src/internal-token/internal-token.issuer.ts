import type { KeyObject } from 'node:crypto';
import { sign } from 'jsonwebtoken';

export interface InternalIdentity {
  id: string;
  role: string;
  email: string;
}

export const INTERNAL_TOKEN_ISSUER = 'auth-service';
export const INTERNAL_TOKEN_AUDIENCE = 'internal';
const INTERNAL_TOKEN_TTL_SECONDS = 120;

// Os serviços internos verificam este token com a chave pública;
// só o auth, que tem a chave privada, consegue emiti-lo.
export class InternalTokenIssuer {
  constructor(private readonly privateKey: KeyObject) {}

  issue({ id, role, email }: InternalIdentity): string {
    return sign({ role, email }, this.privateKey, {
      algorithm: 'ES256',
      subject: id,
      issuer: INTERNAL_TOKEN_ISSUER,
      audience: INTERNAL_TOKEN_AUDIENCE,
      expiresIn: INTERNAL_TOKEN_TTL_SECONDS,
    });
  }
}
