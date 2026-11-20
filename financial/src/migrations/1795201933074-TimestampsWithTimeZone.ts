import { MigrationInterface, QueryRunner } from 'typeorm';

const UTC_TIMEZONES = ['UTC', 'Etc/UTC'];

// created_at e updated_at passam a guardar o instante (timestamptz). As linhas
// existentes foram gravadas pelo DEFAULT now() no fuso da sessão, e o ALTER
// sem USING converte justamente com o fuso da sessão. Em UTC, o PostgreSQL só
// troca o tipo no catálogo, sem reescrever a tabela nem os índices (inclusive
// o parcial das PENDING). Fora de UTC, as datas seriam deslocadas e a tabela
// reescrita: a migration se recusa a rodar.
export class TimestampsWithTimeZone1795201933074 implements MigrationInterface {
  name = 'TimestampsWithTimeZone1795201933074';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertUtcSession(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "updated_at" TYPE TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.assertUtcSession(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "updated_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "created_at" TYPE TIMESTAMP`,
    );
  }

  private async assertUtcSession(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT current_setting('TimeZone') AS timezone`,
    )) as { timezone: string }[];
    const timezone = rows[0].timezone;
    if (!UTC_TIMEZONES.includes(timezone)) {
      throw new Error(
        `Timestamp migration requires a UTC session, but TimeZone is "${timezone}"`,
      );
    }
  }
}
