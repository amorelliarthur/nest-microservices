// Injetável para que os testes não esperem tempo real
export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
