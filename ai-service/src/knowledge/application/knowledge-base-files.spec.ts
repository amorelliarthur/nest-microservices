import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseKnowledgeDocument } from './parse-knowledge-document';

// Os testes rodam a partir da pasta do ai-service
const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');

describe('knowledge base files', () => {
  const files = readdirSync(KNOWLEDGE_DIR).filter((file) =>
    file.endsWith('.md'),
  );

  it('has documents', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is a valid knowledge document', (file) => {
    expect(() =>
      parseKnowledgeDocument(
        file,
        readFileSync(join(KNOWLEDGE_DIR, file), 'utf8'),
      ),
    ).not.toThrow();
  });
});
