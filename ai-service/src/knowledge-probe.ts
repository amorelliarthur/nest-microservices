import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { EMBEDDING_PROVIDER } from './llm/domain/embedding-provider.port';
import type { EmbeddingProvider } from './llm/domain/embedding-provider.port';
import { loadEvaluationQuestions } from './knowledge/application/evaluation-questions';
import type { EvaluationQuestion } from './knowledge/application/evaluation-questions';
import { KNOWLEDGE_REPOSITORY } from './knowledge/domain/knowledge-repository.port';
import type {
  KnowledgeRepository,
  KnowledgeSearchResult,
} from './knowledge/domain/knowledge-repository.port';
import { KnowledgeCliModule } from './knowledge/knowledge-cli.module';

const QUESTIONS_FILE = resolve(
  process.cwd(),
  'evaluation',
  'knowledge-questions.json',
);

// Sem corte de distância: o objetivo é ver as distâncias reais para calibrar o limite
const SEARCH_LIMIT = 3;
const NO_MAX_DISTANCE = 2;

const isExpected = (
  question: EvaluationQuestion,
  result: KnowledgeSearchResult,
) =>
  question.expected.some(
    (target) =>
      target.documentId === result.documentId &&
      target.section === result.section,
  );

const formatDistance = (distance: number | undefined) =>
  distance === undefined ? '-' : distance.toFixed(3);

async function main() {
  const app = await NestFactory.createApplicationContext(KnowledgeCliModule, {
    logger: ['warn', 'error'],
  });

  try {
    const questions = loadEvaluationQuestions(QUESTIONS_FILE);
    const embeddings = app.get<EmbeddingProvider>(EMBEDDING_PROVIDER);
    const repository = app.get<KnowledgeRepository>(KNOWLEDGE_REPOSITORY);

    // Uma única chamada ao provedor para todas as perguntas
    const vectors = await embeddings.embed(
      questions.map((q) => q.question),
      'query',
    );

    const answerable = questions.filter((q) => q.expected.length > 0).length;
    let top1Correct = 0;
    let inTop3 = 0;
    const correctTop1Distances: number[] = [];
    const unanswerableTop1Distances: number[] = [];

    for (const [index, question] of questions.entries()) {
      const results = await repository.searchSimilar(vectors[index], {
        limit: SEARCH_LIMIT,
        maxDistance: NO_MAX_DISTANCE,
        embeddingModel: embeddings.model,
      });

      console.log(`\n${question.question}`);
      for (const result of results) {
        const mark = isExpected(question, result) ? '✔' : ' ';
        console.log(
          `  ${formatDistance(result.distance)} ${mark} ${result.documentId} > ${result.section}`,
        );
      }

      const [first] = results;
      if (question.expected.length === 0) {
        if (first) unanswerableTop1Distances.push(first.distance);
        continue;
      }

      if (first && isExpected(question, first)) {
        top1Correct++;
        correctTop1Distances.push(first.distance);
      } else {
        console.log('  ✘ a seção esperada não ficou em primeiro lugar');
      }
      if (results.some((result) => isExpected(question, result))) inTop3++;
    }

    const largest = correctTop1Distances.length
      ? Math.max(...correctTop1Distances)
      : undefined;
    const smallest = unanswerableTop1Distances.length
      ? Math.min(...unanswerableTop1Distances)
      : undefined;

    console.log('');
    console.log(
      `Top 1 correto: ${top1Correct} de ${answerable} perguntas com resposta`,
    );
    console.log(`Seção esperada no top 3: ${inTop3} de ${answerable}`);
    console.log(
      `Maior distância entre os top 1 corretos: ${formatDistance(largest)}`,
    );
    console.log(
      `Menor distância entre os top 1 das perguntas sem resposta: ${formatDistance(smallest)}`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  new Logger('KnowledgeProbe').error(
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
