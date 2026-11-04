import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IngestionService } from './knowledge/application/ingestion.service';
import { KnowledgeModule } from './knowledge/knowledge.module';

// Só o necessário para ingerir: sem HTTP, guards nem financial-service
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), KnowledgeModule],
})
class IngestionCliModule {}

const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');

async function main() {
  const logger = new Logger('Ingestion');
  const app = await NestFactory.createApplicationContext(IngestionCliModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const sources = readdirSync(KNOWLEDGE_DIR)
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((name) => ({
        name,
        content: readFileSync(join(KNOWLEDGE_DIR, name), 'utf8'),
      }));

    const report = await app.get(IngestionService).ingest(sources);
    logger.log(
      `Done: ${report.created} created, ${report.updated} updated, ${report.unchanged} unchanged, ${report.deleted} deleted`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  new Logger('Ingestion').error(error instanceof Error ? error.message : error);
  process.exit(1);
});
