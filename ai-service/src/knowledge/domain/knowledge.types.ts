export const KNOWLEDGE_CATEGORIES = ['produto', 'educacao'] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export interface KnowledgeSection {
  title: string;
  content: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: KnowledgeCategory;
  sections: KnowledgeSection[];
}

// Uma seção pronta para virar vetor
export interface KnowledgeChunk {
  documentId: string;
  documentTitle: string;
  section: string;
  category: KnowledgeCategory;
  content: string;
  embeddingText: string;
  contentHash: string;
}
