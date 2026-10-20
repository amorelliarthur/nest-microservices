import { z } from 'zod';
import type { ToolCall } from '../../../llm/domain/llm-provider.port';
import { defineTool } from './tool';
import { ToolError } from './tool.error';
import { ToolRegistry } from './tool-registry';

const echoTool = defineTool({
  name: 'echo_account',
  description: 'Echoes the account and the user',
  schema: z.object({ accountId: z.string().min(1) }),
  execute: ({ accountId }, { userId }) =>
    Promise.resolve({ accountId, userId }),
});

const notFoundTool = defineTool({
  name: 'not_found',
  description: 'Always fails with an expected error',
  schema: z.object({}),
  execute: () => Promise.reject(new ToolError('Account not found')),
});

const buggyTool = defineTool({
  name: 'buggy',
  description: 'Always fails with an unexpected error',
  schema: z.object({}),
  execute: () => Promise.reject(new TypeError('boom')),
});

const call = (name: string, args: Record<string, unknown> = {}): ToolCall => ({
  id: 'call-1',
  name,
  arguments: args,
});

const context = { userId: 'user-1' };

describe('ToolRegistry', () => {
  const registry = new ToolRegistry([echoTool, notFoundTool, buggyTool]);

  it('exposes JSON Schema definitions generated from the zod schemas', () => {
    const definition = registry
      .definitions()
      .find((d) => d.name === 'echo_account');

    expect(definition?.description).toBe('Echoes the account and the user');
    expect(definition?.parameters).toMatchObject({
      type: 'object',
      properties: { accountId: { type: 'string' } },
      required: ['accountId'],
    });
    expect(definition?.parameters).not.toHaveProperty('$schema');
  });

  it('executes the tool with validated arguments and the user from the context', async () => {
    await expect(
      registry.execute(call('echo_account', { accountId: 'acc-1' }), context),
    ).resolves.toEqual({
      ok: true,
      output: { accountId: 'acc-1', userId: 'user-1' },
    });
  });

  it('ignores a userId sent by the model, using only the context', async () => {
    const result = await registry.execute(
      call('echo_account', { accountId: 'acc-1', userId: 'user-2' }),
      context,
    );

    expect(result).toEqual({
      ok: true,
      output: { accountId: 'acc-1', userId: 'user-1' },
    });
  });

  it('returns an error for an unknown tool', async () => {
    await expect(
      registry.execute(call('delete_everything'), context),
    ).resolves.toEqual({ ok: false, error: 'Unknown tool: delete_everything' });
  });

  it('returns the validation issues when the arguments are invalid', async () => {
    const result = await registry.execute(call('echo_account', {}), context);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain('accountId');
  });

  it('returns the message of an expected ToolError', async () => {
    await expect(registry.execute(call('not_found'), context)).resolves.toEqual(
      { ok: false, error: 'Account not found' },
    );
  });

  it('rethrows unexpected errors so bugs are not hidden', async () => {
    await expect(registry.execute(call('buggy'), context)).rejects.toThrow(
      TypeError,
    );
  });
});
