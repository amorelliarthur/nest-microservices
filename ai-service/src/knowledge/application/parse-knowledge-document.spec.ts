import { KnowledgeDocumentError } from '../domain/knowledge-document.error';
import { parseKnowledgeDocument } from './parse-knowledge-document';

const doc = (
  body: string,
  header = 'id: transacoes\ntitle: Transações\ncategory: produto',
) => `---\n${header}\n---\n\n${body}`;

describe('parseKnowledgeDocument', () => {
  it('reads the frontmatter and splits the content by "## " sections', () => {
    const result = parseKnowledgeDocument(
      'transacoes.md',
      doc(
        '## Saldo insuficiente\n\nO saque é recusado.\n\n## Valor mínimo\n\nR$ 0,01.\n',
      ),
    );

    expect(result).toEqual({
      id: 'transacoes',
      title: 'Transações',
      category: 'produto',
      sections: [
        { title: 'Saldo insuficiente', content: 'O saque é recusado.' },
        { title: 'Valor mínimo', content: 'R$ 0,01.' },
      ],
    });
  });

  it('keeps "### " subsections inside the section content', () => {
    const result = parseKnowledgeDocument(
      'transacoes.md',
      doc('## Transferência\n\nTexto.\n\n### Detalhe\n\nMais texto.'),
    );

    expect(result.sections).toEqual([
      {
        title: 'Transferência',
        content: 'Texto.\n\n### Detalhe\n\nMais texto.',
      },
    ]);
  });

  it('accepts Windows line endings', () => {
    const raw = doc('## Seção\n\nTexto.').replace(/\n/g, '\r\n');

    expect(parseKnowledgeDocument('transacoes.md', raw).sections).toHaveLength(
      1,
    );
  });

  it('rejects a document without frontmatter', () => {
    expect(() =>
      parseKnowledgeDocument('transacoes.md', '## Seção\n\nTexto.'),
    ).toThrow(KnowledgeDocumentError);
  });

  it('rejects an unknown category, naming the field', () => {
    expect(() =>
      parseKnowledgeDocument(
        'transacoes.md',
        doc(
          '## Seção\n\nTexto.',
          'id: transacoes\ntitle: Transações\ncategory: produtos',
        ),
      ),
    ).toThrow(/transacoes\.md.*category/);
  });

  it('rejects an id that does not match the file name', () => {
    expect(() =>
      parseKnowledgeDocument('contas.md', doc('## Seção\n\nTexto.')),
    ).toThrow(/contas\.md.*id/);
  });

  it('rejects text before the first section', () => {
    expect(() =>
      parseKnowledgeDocument(
        'transacoes.md',
        doc('Introdução solta.\n\n## Seção\n\nTexto.'),
      ),
    ).toThrow(/before the first/);
  });

  it('rejects a document without sections', () => {
    expect(() => parseKnowledgeDocument('transacoes.md', doc(''))).toThrow(
      /no "## " sections/,
    );
  });

  it('rejects an empty section', () => {
    expect(() =>
      parseKnowledgeDocument(
        'transacoes.md',
        doc('## Vazia\n\n## Cheia\n\nTexto.'),
      ),
    ).toThrow(/"Vazia" is empty/);
  });

  it('rejects duplicate section titles', () => {
    expect(() =>
      parseKnowledgeDocument(
        'transacoes.md',
        doc('## Seção\n\nA.\n\n## Seção\n\nB.'),
      ),
    ).toThrow(/duplicate section "Seção"/);
  });
});
