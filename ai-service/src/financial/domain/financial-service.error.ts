// Falha ao obter dados do financial-service (rede, timeout, status de erro ou formato inesperado)
export class FinancialServiceError extends Error {
  constructor(readonly reason: string) {
    super(`Financial service request failed: ${reason}`);
    this.name = 'FinancialServiceError';
  }
}
