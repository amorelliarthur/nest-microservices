import type { KnowledgeDocument } from '../domain/knowledge.types';
import { toChunks } from './knowledge-chunks';

const document: KnowledgeDocument = {
  id: 'transacoes',
  title: 'Transações',
  category: 'produto',
  sections: [
    { title: 'Saldo insuficiente', content: 'O saque é recusado.' },
    { title: 'Valor mínimo', content: 'R$ 0,01.' },
  ],
};

describe('toChunks', () => {
  it('creates one chunk per section with the document metadata', () => {
    const [first] = toChunks(document);

    expect(first).toMatchObject({
      documentId: 'transacoes',
      documentTitle: 'Transações',
      section: 'Saldo insuficiente',
      category: 'produto',
      content: 'O saque é recusado.',
    });
    expect(toChunks(document)).toHaveLength(2);
  });

  it('adds the document and section titles to the text that will be embedded', () => {
    expect(toChunks(document)[0].embeddingText).toBe(
      'Transações > Saldo insuficiente\n\nO saque é recusado.',
    );
  });

  it('produces a stable hash that changes when the section changes', () => {
    const [original] = toChunks(document);
    const [again] = toChunks(document);
    const [edited] = toChunks({
      ...document,
      sections: [{ title: 'Saldo insuficiente', content: 'Texto novo.' }],
    });

    expect(original.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(again.contentHash).toBe(original.contentHash);
    expect(edited.contentHash).not.toBe(original.contentHash);
  });
});
