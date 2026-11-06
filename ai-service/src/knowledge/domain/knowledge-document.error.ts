// Documento inválido: a ingestão para com o arquivo e o motivo
export class KnowledgeDocumentError extends Error {
  constructor(
    readonly fileName: string,
    reason: string,
  ) {
    super(`${fileName}: ${reason}`);
    this.name = 'KnowledgeDocumentError';
  }
}
