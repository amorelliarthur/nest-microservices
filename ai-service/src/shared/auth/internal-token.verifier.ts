import type { KeyObject } from 'node:crypto';
import { verify } from 'jsonwebtoken';

// Must match what the auth service uses when issuing the internal token
export const INTERNAL_TOKEN_ISSUER = 'auth-service';
export const INTERNAL_TOKEN_AUDIENCE = 'internal';

export interface VerifiedIdentity {
  id: string;
  role: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

// Verifies the internal token issued by auth (ES256). Any problem yields null:
// the caller decides how to reject, without telling the client why.
export class InternalTokenVerifier {
  constructor(private readonly publicKey: KeyObject) {}

  verify(token: unknown): VerifiedIdentity | null {
    if (!isNonEmptyString(token)) {
      return null;
    }

    let payload: unknown;
    try {
      payload = verify(token, this.publicKey, {
        algorithms: ['ES256'],
        issuer: INTERNAL_TOKEN_ISSUER,
        audience: INTERNAL_TOKEN_AUDIENCE,
      });
    } catch {
      return null;
    }

    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const { sub, role } = payload as Record<string, unknown>;
    if (!isNonEmptyString(sub) || !isNonEmptyString(role)) {
      return null;
    }

    return { id: sub, role };
  }
}
