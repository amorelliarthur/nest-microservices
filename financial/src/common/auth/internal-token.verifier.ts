import type { KeyObject } from 'node:crypto';
import { verify } from 'jsonwebtoken';
import type { Requester } from './requester';

// Devem bater com o que o auth usa ao emitir o token interno
export const INTERNAL_TOKEN_ISSUER = 'auth-service';
export const INTERNAL_TOKEN_AUDIENCE = 'internal';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

// Verifica o token interno emitido pelo auth (ES256) e devolve quem fez a
// requisição. Qualquer problema no token resulta em null: quem chama decide
// como recusar, sem expor o motivo ao cliente.
export class InternalTokenVerifier {
  constructor(private readonly publicKey: KeyObject) {}

  verify(token: unknown): Requester | null {
    if (!isNonEmptyString(token)) {
      return null;
    }

    let payload: unknown;
    try {
      payload = verify(token, this.publicKey, {
        // Defesa extra: o jsonwebtoken 9 já recusa HS256, none e outras curvas
        // com esta chave P-256, mas fixar o algoritmo não depende disso
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
