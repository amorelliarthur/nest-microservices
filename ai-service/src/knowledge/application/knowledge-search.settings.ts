import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const KNOWLEDGE_SEARCH_SETTINGS = Symbol('KNOWLEDGE_SEARCH_SETTINGS');

export interface KnowledgeSearchSettings {
  limit: number;
  maxDistance: number;
}

// Medido com o knowledge:probe: respostas certas até 0,289; perguntas sem resposta a partir de 0,411
export const DEFAULT_MAX_DISTANCE = 0.35;
export const DEFAULT_SEARCH_LIMIT = 4;

// A distância de cosseno vai de 0 a 2
const maxDistanceSchema = z.coerce.number().positive().max(2);

export const createKnowledgeSearchSettings = (
  config: ConfigService,
): KnowledgeSearchSettings => {
  // Fail fast: um limite inválido impede o serviço de subir, com mensagem clara
  const rawMaxDistance = config.get<string>('KNOWLEDGE_MAX_DISTANCE');
  const maxDistance = maxDistanceSchema.safeParse(
    rawMaxDistance ?? DEFAULT_MAX_DISTANCE,
  );
  if (!maxDistance.success) {
    throw new Error(
      `Invalid KNOWLEDGE_MAX_DISTANCE "${rawMaxDistance}": expected a cosine distance greater than 0 and up to 2`,
    );
  }
  return { limit: DEFAULT_SEARCH_LIMIT, maxDistance: maxDistance.data };
};
