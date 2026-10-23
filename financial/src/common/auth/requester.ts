// Quem fez a requisição, conforme os headers injetados pelo gateway
export interface Requester {
  id: string;
  role: string;
}

// Regra única de acesso: o dono do recurso ou um ADMIN
export const canAccess = (requester: Requester, ownerId: string): boolean =>
  requester.role === 'ADMIN' || requester.id === ownerId;
