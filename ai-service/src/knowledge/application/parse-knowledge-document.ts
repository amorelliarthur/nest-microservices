import { z } from 'zod';
import { formatZodIssues } from '../../shared/zod/format-zod-issues';
import { KnowledgeDocumentError } from '../domain/knowledge-document.error';
import { KNOWLEDGE_CATEGORIES } from '../domain/knowledge.types';
import type {
  KnowledgeDocument,
  KnowledgeSection,
} from '../domain/knowledge.types';

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const SECTION_HEADING = /^## (.+)$/;

const frontmatterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  category: z.enum(KNOWLEDGE_CATEGORIES),
});

// Cabeçalho simples: só linhas "chave: valor", sem YAML completo
const parseFrontmatter = (text: string, fail: (reason: string) => Error) =>
  Object.fromEntries(
    text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const separator = line.indexOf(':');
        if (separator <= 0) throw fail(`invalid frontmatter line "${line}"`);
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  );

export const parseKnowledgeDocument = (
  fileName: string,
  raw: string,
): KnowledgeDocument => {
  const fail = (reason: string) => new KnowledgeDocumentError(fileName, reason);

  const match = FRONTMATTER.exec(raw.replace(/\r\n/g, '\n'));
  if (!match) throw fail('missing frontmatter (--- ... ---)');
  const [, frontmatterText, body] = match;

  const frontmatter = frontmatterSchema.safeParse(
    parseFrontmatter(frontmatterText, fail),
  );
  if (!frontmatter.success) {
    throw fail(
      `invalid frontmatter: ${formatZodIssues(frontmatter.error).join('; ')}`,
    );
  }

  // O id é a chave do documento no banco: amarrá-lo ao nome do arquivo evita sobrescritas
  const expectedId = fileName.replace(/\.md$/, '');
  if (frontmatter.data.id !== expectedId) {
    throw fail(
      `id "${frontmatter.data.id}" must match the file name "${expectedId}"`,
    );
  }

  const sections: KnowledgeSection[] = [];
  let current: { title: string; lines: string[] } | null = null;
  const flush = () => {
    if (current) {
      sections.push({
        title: current.title,
        content: current.lines.join('\n').trim(),
      });
    }
  };

  for (const line of body.split('\n')) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      flush();
      current = { title: heading[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim() !== '') {
      throw fail('text found before the first "## " section');
    }
  }
  flush();

  if (sections.length === 0) throw fail('no "## " sections found');

  const titles = new Set<string>();
  for (const section of sections) {
    if (section.content === '')
      throw fail(`section "${section.title}" is empty`);
    if (titles.has(section.title))
      throw fail(`duplicate section "${section.title}"`);
    titles.add(section.title);
  }

  return { ...frontmatter.data, sections };
};
