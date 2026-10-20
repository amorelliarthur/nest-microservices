// Erro esperado e seguro de mostrar ao modelo (ex.: "Account not found")
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}
