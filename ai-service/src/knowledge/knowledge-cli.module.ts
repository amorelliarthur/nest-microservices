import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeModule } from './knowledge.module';

// Só o necessário para os comandos da base: sem HTTP, guards nem financial-service
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), KnowledgeModule],
})
export class KnowledgeCliModule {}
