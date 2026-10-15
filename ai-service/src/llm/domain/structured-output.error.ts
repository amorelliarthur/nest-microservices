export class StructuredOutputError extends Error {
  constructor(
    readonly reason: string,
    readonly attempts: number,
  ) {
    super(
      `LLM failed to produce valid output after ${attempts} attempts: ${reason}`,
    );
    this.name = 'StructuredOutputError';
  }
}
