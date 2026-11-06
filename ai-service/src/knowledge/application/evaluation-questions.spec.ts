import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvaluationQuestions } from './evaluation-questions';
import { parseKnowledgeDocument } from './parse-knowledge-document';

// Os testes rodam a partir da pasta do ai-service
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');
const QUESTIONS_FILE = resolve(
  process.cwd(),
  'evaluation',
  'knowledge-questions.json',
);

describe('knowledge search evaluation questions', () => {
  const questions = loadEvaluationQuestions(QUESTIONS_FILE);

  const sectionsByDocument = new Map(
    readdirSync(KNOWLEDGE_DIR)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const document = parseKnowledgeDocument(
          file,
          readFileSync(join(KNOWLEDGE_DIR, file), 'utf8'),
        );
        return [
          document.id,
          new Set(document.sections.map((section) => section.title)),
        ] as const;
      }),
  );

  const expectedSections = questions.flatMap(({ question, expected }) =>
    expected.map((target) => ({ question, ...target })),
  );

  it('has questions with and without an answer in the knowledge base', () => {
    expect(questions.some((q) => q.expected.length > 0)).toBe(true);
    expect(questions.some((q) => q.expected.length === 0)).toBe(true);
  });

  it.each(expectedSections)(
    '"$question" expects an existing section: $documentId > $section',
    ({ documentId, section }) => {
      expect(sectionsByDocument.get(documentId)?.has(section)).toBe(true);
    },
  );
});
