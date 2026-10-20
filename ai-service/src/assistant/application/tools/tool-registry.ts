import { z } from 'zod';
import type {
  ToolCall,
  ToolDefinition,
} from '../../../llm/domain/llm-provider.port';
import { formatZodIssues } from '../../../shared/zod/format-zod-issues';
import type { Tool, ToolContext } from './tool';
import { ToolError } from './tool.error';

export type ToolResult =
  { ok: true; output: unknown } | { ok: false; error: string };

export class ToolRegistry {
  private readonly tools: Map<string, Tool>;

  constructor(tools: Tool[]) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => {
      const parameters: Record<string, unknown> = {
        ...z.toJSONSchema(tool.schema),
      };
      delete parameters.$schema;
      return { name: tool.name, description: tool.description, parameters };
    });
  }

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) return { ok: false, error: `Unknown tool: ${call.name}` };

    try {
      return { ok: true, output: await tool.execute(call.arguments, context) };
    } catch (error) {
      // Erros esperados voltam ao modelo; qualquer outro é bug e precisa aparecer
      if (error instanceof z.ZodError) {
        return {
          ok: false,
          error: `Invalid arguments: ${formatZodIssues(error).join('; ')}`,
        };
      }
      if (error instanceof ToolError)
        return { ok: false, error: error.message };
      throw error;
    }
  }
}
