import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from '../../llm/domain/embedding-provider.port';
import type { EmbeddingProvider } from '../../llm/domain/embedding-provider.port';
import { KNOWLEDGE_REPOSITORY } from '../domain/knowledge-repository.port';
import type {
  ChunkKey,
  KnowledgeRepository,
} from '../domain/knowledge-repository.port';
import { toChunks } from './knowledge-chunks';
import { parseKnowledgeDocument } from './parse-knowledge-document';

export interface KnowledgeSource {
  name: string;
  content: string;
}

export interface IngestionReport {
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
}

const BATCH_SIZE = 50;
const keyOf = (key: ChunkKey) => `${key.documentId}\u0000${key.section}`;

@Injectable()
export class IngestionService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddings: EmbeddingProvider,
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repository: KnowledgeRepository,
  ) {}

  async ingest(sources: KnowledgeSource[]): Promise<IngestionReport> {
    // Valida tudo antes de qualquer chamada externa: um documento inválido não muda nada
    const chunks = sources.flatMap((source) =>
      toChunks(parseKnowledgeDocument(source.name, source.content)),
    );

    const stored = new Map(
      (await this.repository.listFingerprints()).map((fingerprint) => [
        keyOf(fingerprint),
        fingerprint,
      ]),
    );

    const changed = chunks.filter((chunk) => {
      const current = stored.get(keyOf(chunk));
      // Vetor de outro modelo não é comparável: precisa ser gerado de novo
      return (
        !current ||
        current.contentHash !== chunk.contentHash ||
        current.embeddingModel !== this.embeddings.model
      );
    });

    const currentKeys = new Set(chunks.map(keyOf));
    const removed = [...stored.values()].filter(
      (fingerprint) => !currentKeys.has(keyOf(fingerprint)),
    );

    // Gera todos os vetores antes de gravar: uma falha no provedor não deixa a base pela metade
    const vectors: number[][] = [];
    for (let start = 0; start < changed.length; start += BATCH_SIZE) {
      const batch = changed.slice(start, start + BATCH_SIZE);
      vectors.push(
        ...(await this.embeddings.embed(
          batch.map((chunk) => chunk.embeddingText),
          'document',
        )),
      );
    }

    // Gravar e apagar não são atômicos entre si; como a ingestão é idempotente,
    // uma nova execução converge para o estado correto
    await this.repository.upsertChunks(
      changed.map((chunk, index) => ({
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        section: chunk.section,
        category: chunk.category,
        content: chunk.content,
        contentHash: chunk.contentHash,
        embedding: vectors[index],
        embeddingModel: this.embeddings.model,
      })),
    );
    await this.repository.deleteChunks(
      removed.map(({ documentId, section }) => ({ documentId, section })),
    );

    const created = changed.filter((chunk) => !stored.has(keyOf(chunk))).length;
    return {
      created,
      updated: changed.length - created,
      unchanged: chunks.length - changed.length,
      deleted: removed.length,
    };
  }
}
