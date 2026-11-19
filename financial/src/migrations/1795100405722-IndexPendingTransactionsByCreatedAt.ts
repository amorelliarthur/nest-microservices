import { MigrationInterface, QueryRunner } from 'typeorm';

// Índice parcial: só guarda as transações PENDING, que são poucas, e atende a
// rotina que encerra as PENDING antigas sem ler a tabela inteira
export class IndexPendingTransactionsByCreatedAt1795100405722 implements MigrationInterface {
  name = 'IndexPendingTransactionsByCreatedAt1795100405722';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_pending_created_at" ON "transactions" ("created_at") WHERE "status" = 'PENDING'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transactions_pending_created_at"`,
    );
  }
}
