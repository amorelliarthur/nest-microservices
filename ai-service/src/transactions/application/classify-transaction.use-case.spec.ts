import { StructuredOutputService } from '../../llm/application/structured-output.service';
import { FakeLlmProvider } from '../../llm/testing/fake-llm.provider';
import { ClassifyTransactionUseCase } from './classify-transaction.use-case';

const makeSut = (reply: string) => {
  const llm = new FakeLlmProvider([reply]);
  const useCase = new ClassifyTransactionUseCase(
    new StructuredOutputService(llm),
  );
  return { llm, useCase };
};

describe('ClassifyTransactionUseCase', () => {
  it('returns the classification without review when confidence is high', async () => {
    const { useCase } = makeSut('{"category":"transporte","confidence":0.92}');

    await expect(useCase.execute('Uber para o aeroporto')).resolves.toEqual({
      category: 'transporte',
      confidence: 0.92,
      needsReview: false,
    });
  });

  it('flags the classification for review when confidence is below 0.7', async () => {
    const { useCase } = makeSut('{"category":"lazer","confidence":0.4}');

    const result = await useCase.execute('Pagamento diverso');

    expect(result.needsReview).toBe(true);
  });

  it('treats a confidence of exactly 0.7 as reliable', async () => {
    const { useCase } = makeSut('{"category":"saude","confidence":0.7}');

    const result = await useCase.execute('Farmácia');

    expect(result.needsReview).toBe(false);
  });

  it('wraps the description in delimiters and lists the allowed categories', async () => {
    const { llm, useCase } = makeSut(
      '{"category":"alimentacao","confidence":0.9}',
    );

    await useCase.execute('iFood jantar');

    const [request] = llm.requests;
    expect(request.messages[0].content).toBe(
      '<descricao>iFood jantar</descricao>',
    );
    expect(request.system).toContain('alimentacao, transporte');
  });
});
