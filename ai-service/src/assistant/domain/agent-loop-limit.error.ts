export class AgentLoopLimitError extends Error {
  constructor(readonly iterations: number) {
    super(`Agent did not finish within ${iterations} iterations`);
    this.name = 'AgentLoopLimitError';
  }
}
