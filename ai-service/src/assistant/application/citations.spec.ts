import { resolveCitations, SourceCollector, toSourceId } from './citations';

const collector = () => {
  const sources = new SourceCollector();
  sources.add({
    sourceId: 'produto-transacoes#saldo-insuficiente',
    document: 'Transações',
    section: 'Saldo insuficiente',
  });
  sources.add({
    sourceId: 'educacao-orcamento#a-regra-50-30-20',
    document: 'Orçamento',
    section: 'A regra 50/30/20',
  });
  return sources;
};

describe('toSourceId', () => {
  it('builds a stable id from the document and the section title', () => {
    expect(
      toSourceId('produto-transacoes', 'Transferência para a mesma conta'),
    ).toBe('produto-transacoes#transferencia-para-a-mesma-conta');
  });

  it('turns symbols into hyphens', () => {
    expect(toSourceId('educacao-orcamento', 'A regra 50/30/20')).toBe(
      'educacao-orcamento#a-regra-50-30-20',
    );
  });
});

describe('resolveCitations', () => {
  it('numbers the cited sources in order of first appearance', () => {
    const result = resolveCitations(
      'O saque é recusado [produto-transacoes#saldo-insuficiente]. A regra divide a renda [educacao-orcamento#a-regra-50-30-20].',
      collector(),
    );

    expect(result).toEqual({
      answer: 'O saque é recusado [1]. A regra divide a renda [2].',
      citations: [
        { id: 1, document: 'Transações', section: 'Saldo insuficiente' },
        { id: 2, document: 'Orçamento', section: 'A regra 50/30/20' },
      ],
      unknownSourceIds: [],
    });
  });

  it('reuses the number when the same source is cited again', () => {
    const result = resolveCitations(
      'A [produto-transacoes#saldo-insuficiente] e B [produto-transacoes#saldo-insuficiente].',
      collector(),
    );

    expect(result.answer).toBe('A [1] e B [1].');
    expect(result.citations).toHaveLength(1);
  });

  it('removes citations of sources the search did not return', () => {
    const result = resolveCitations(
      'Os juros são de 8% ao mês [produto-contas#cheque-especial].',
      collector(),
    );

    expect(result).toEqual({
      answer: 'Os juros são de 8% ao mês.',
      citations: [],
      unknownSourceIds: ['produto-contas#cheque-especial'],
    });
  });

  it('handles adjacent citations', () => {
    expect(
      resolveCitations(
        'Regras [produto-transacoes#saldo-insuficiente][educacao-orcamento#a-regra-50-30-20].',
        collector(),
      ).answer,
    ).toBe('Regras [1][2].');
  });

  it('keeps an answer without citations unchanged', () => {
    expect(resolveCitations('Seu saldo é R$ 1.782,85.', collector())).toEqual({
      answer: 'Seu saldo é R$ 1.782,85.',
      citations: [],
      unknownSourceIds: [],
    });
  });
});
