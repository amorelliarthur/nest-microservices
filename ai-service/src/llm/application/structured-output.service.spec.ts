import { z } from 'zod';
import { StructuredOutputError } from '../domain/structured-output.error';
import { FakeLlmProvider } from '../testing/fake-llm.provider';
import { StructuredOutputService } from './structured-output.service';

const schema = z.object({
  category: z.enum(['alimentacao', 'transporte']),
  confidence: z.number().min(0).max(1),
});

const validJson = '{"category":"transporte","confidence":0.9}';

describe('StructuredOutputService', () => {
  const run = (llm: FakeLlmProvider, maxAttempts?: number) =>
    new StructuredOutputService(llm).generate({
      schema,
      system: 'Classifique a transação.',
      prompt: 'Uber para o aeroporto',
      maxAttempts,
    });

  it('returns parsed data when the first response is valid', async () => {
    const llm = new FakeLlmProvider([validJson]);

    await expect(run(llm)).resolves.toEqual({
      category: 'transporte',
      confidence: 0.9,
    });
    expect(llm.requests).toHaveLength(1);
  });

  it('strips markdown code fences before parsing', async () => {
    const llm = new FakeLlmProvider(['```json\n' + validJson + '\n```']);

    await expect(run(llm)).resolves.toEqual({
      category: 'transporte',
      confidence: 0.9,
    });
  });

  it('retries sending the previous answer and the validation error to the model', async () => {
    const invalid = '{"category":"viagem","confidence":0.9}';
    const llm = new FakeLlmProvider([invalid, validJson]);

    await expect(run(llm)).resolves.toEqual({
      category: 'transporte',
      confidence: 0.9,
    });

    const retry = llm.requests[1];
    expect(retry.messages).toHaveLength(3);
    expect(retry.messages[1]).toEqual({ role: 'assistant', content: invalid });
    expect(retry.messages[2].content).toContain('category');
  });

  it('treats malformed JSON as a failed attempt', async () => {
    const llm = new FakeLlmProvider(['isso não é json', validJson]);

    await expect(run(llm)).resolves.toEqual({
      category: 'transporte',
      confidence: 0.9,
    });
    expect(llm.requests).toHaveLength(2);
  });

  it('throws StructuredOutputError after reaching maxAttempts', async () => {
    const llm = new FakeLlmProvider(['{}', '{}', '{}']);

    await expect(run(llm, 3)).rejects.toThrow(StructuredOutputError);
    expect(llm.requests).toHaveLength(3);
  });
});
