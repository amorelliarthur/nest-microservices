import { createHash } from 'node:crypto';
import type {
  KnowledgeChunk,
  KnowledgeDocument,
} from '../domain/knowledge.types';

export const toChunks = (document: KnowledgeDocument): KnowledgeChunk[] =>
  document.sections.map((section) => {
    // O trecho é buscado isolado: os títulos dão contexto ao vetor
    const embeddingText = `${document.title} > ${section.title}\n\n${section.content}`;
    return {
      documentId: document.id,
      documentTitle: document.title,
      section: section.title,
      category: document.category,
      content: section.content,
      embeddingText,
      // Calculado sobre o texto do embedding: qualquer mudança relevante gera novo vetor
      contentHash: createHash('sha256').update(embeddingText).digest('hex'),
    };
  });
