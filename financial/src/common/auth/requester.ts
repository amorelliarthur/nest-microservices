// Quem fez a requisição, conforme o token interno assinado pelo auth
export interface Requester {
  id: string;
  role: string;
}

// Regra única de acesso: o dono do recurso ou um ADMIN
export const canAccess = (requester: Requester, ownerId: string): boolean =>
  requester.role === 'ADMIN' || requester.id === ownerId;
