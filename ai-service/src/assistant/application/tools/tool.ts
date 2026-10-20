import type { z } from 'zod';

export interface ToolContext {
  userId: string;
}

export interface Tool {
  name: string;
  description: string;
  schema: z.ZodType;
  execute(args: unknown, context: ToolContext): Promise<unknown>;
}

interface ToolSpec<T> {
  name: string;
  description: string;
  schema: z.ZodType<T>;
  execute(args: T, context: ToolContext): Promise<unknown>;
}

// Os argumentos SEMPRE passam pelo schema antes do execute: nenhuma tool roda sem validação
export const defineTool = <T>(spec: ToolSpec<T>): Tool => ({
  name: spec.name,
  description: spec.description,
  schema: spec.schema,
  execute: (args, context) => spec.execute(spec.schema.parse(args), context),
});
