// Injetável para que o "agora" seja controlável nos testes
export type Clock = () => Date;
export const CLOCK = Symbol('CLOCK');
