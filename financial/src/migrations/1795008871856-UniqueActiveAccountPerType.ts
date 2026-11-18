import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueActiveAccountPerType1795008871856 implements MigrationInterface {
  name = 'UniqueActiveAccountPerType1795008871856';

  // falha se já existirem duas contas ativas do mesmo tipo para um usuário:
  // as duplicatas precisam ser resolvidas antes de rodar esta migration
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_accounts_user_id_type_active" ON "accounts" ("user_id", "type") WHERE "active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_accounts_user_id_type_active"`,
    );
  }
}
