import { z } from 'zod';
import type { KnowledgeSearchService } from '../../../knowledge/application/knowledge-search.service';
import type { KnowledgeSearchResult } from '../../../knowledge/domain/knowledge-repository.port';
import { KNOWLEDGE_CATEGORIES } from '../../../knowledge/domain/knowledge.types';
import { LlmProviderError } from '../../../llm/domain/llm-provider.error';
import { defineTool } from './tool';
import type { Tool } from './tool';
import { ToolError } from './tool.error';

export const createKnowledgeTools = (
  search: KnowledgeSearchService,
): Tool[] => [
  defineTool({
    name: 'search_knowledge',
    description:
      'Searches the knowledge base about how this banking system works (accounts, transactions, transfers, the assistant itself) ' +
      'and general financial education (emergency fund, budgeting, the 50/30/20 rule). ' +
      "Use it for questions about rules and concepts. Do NOT use it for the user's own data: use the financial tools for balances and transactions.",
    schema: z.object({
      query: z
        .string()
        .min(3)
        .max(300)
        .describe('What to search for, in Portuguese'),
      category: z
        .enum(KNOWLEDGE_CATEGORIES)
        .optional()
        .describe(
          'produto = how the system works; educacao = financial education',
        ),
    }),
    execute: async ({ query, category }) => {
      let results: KnowledgeSearchResult[];
      try {
        results = await search.search(query, category);
      } catch (error) {
        // Degradação elegante: o assistente ainda pode usar as outras tools e explicar a falha
        if (error instanceof LlmProviderError) {
          throw new ToolError(
            'The knowledge base is temporarily unavailable. Try again later.',
          );
        }
        throw error;
      }

      // "Nada encontrado" explícito: uma lista vazia é fácil de o modelo ignorar
      if (results.length === 0) {
        return {
          found: false,
          message:
            'No relevant information was found in the knowledge base. Tell the user you could not find this information.',
        };
      }

      // A distância já cumpriu seu papel no filtro: o modelo recebe só o conteúdo e a origem
      return {
        found: true,
        results: results.map((result) => ({
          source: {
            documentId: result.documentId,
            document: result.documentTitle,
            section: result.section,
          },
          content: result.content,
        })),
      };
    },
  }),
];
