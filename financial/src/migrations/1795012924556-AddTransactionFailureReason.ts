import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTransactionFailureReason1795012924556 implements MigrationInterface {
  name = 'AddTransactionFailureReason1795012924556';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "failure_reason" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "failure_reason"`,
    );
  }
}
