// Quem fez a requisição, conforme o token interno assinado pelo auth
export interface Requester {
  id: string;
  role: string;
}
