import { readFileSync } from 'node:fs';
import { z } from 'zod';

const evaluationQuestionsSchema = z.array(
  z.object({
    question: z.string().min(1),
    // Lista vazia: a pergunta não tem resposta na base de conhecimento
    expected: z.array(
      z.object({
        documentId: z.string().min(1),
        section: z.string().min(1),
      }),
    ),
  }),
);

export type EvaluationQuestion = z.infer<
  typeof evaluationQuestionsSchema
>[number];

export const loadEvaluationQuestions = (path: string): EvaluationQuestion[] =>
  evaluationQuestionsSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
