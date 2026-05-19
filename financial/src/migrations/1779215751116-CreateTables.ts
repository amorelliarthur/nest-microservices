import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTables1779215751116 implements MigrationInterface {
    name = 'CreateTables1779215751116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "account_id" uuid NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "description" character varying, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "target_account_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b9d2f8434bdcdf20f2a829fe77" ON "transactions" ("account_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" character varying NOT NULL, "type" "public"."accounts_type_enum" NOT NULL DEFAULT 'CHECKING', "balance" numeric(10,2) NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b9d2f8434bdcdf20f2a829fe77"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
    }

}
