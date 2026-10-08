import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1791455727995 implements MigrationInterface {
    name = 'Init1791455727995'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "installmentId" uuid NOT NULL, "creditId" uuid NOT NULL, "amountMinor" bigint NOT NULL, "paidAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ad038f1a0071dfcec821512949" ON "payments"  ("installmentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e71e2e3092300ddf79ca360229" ON "payments"  ("creditId") `);
        await queryRunner.query(`CREATE TABLE "installments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "creditId" uuid NOT NULL, "sequence" integer NOT NULL, "dueAt" date NOT NULL, "amountMinor" bigint NOT NULL, "principalMinor" bigint NOT NULL, "interestMinor" bigint NOT NULL, "remainingMinor" bigint NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'planned', CONSTRAINT "uq_installment_credit_sequence" UNIQUE ("creditId", "sequence"), CONSTRAINT "PK_c74e44aa06bdebef2af0a93da1b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_948f7fb5ffc9373c7cc323c628" ON "installments"  ("creditId") `);
        await queryRunner.query(`CREATE TABLE "programs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(16) NOT NULL, "title" character varying(140) NOT NULL, "description" text NOT NULL, "ratePercent" numeric(5,2) NOT NULL, "minAmountMinor" bigint NOT NULL, "maxAmountMinor" bigint NOT NULL, "minTermMonths" integer NOT NULL, "maxTermMonths" integer NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'RUB', "published" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_d43c664bcaafc0e8a06dfd34e05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2b655a95f22dc941f3c2c4e0a1" ON "programs"  ("published") `);
        await queryRunner.query(`CREATE TABLE "credits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "clientId" uuid NOT NULL, "programId" uuid, "type" character varying(16) NOT NULL, "title" character varying(120) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', "currency" character varying(3) NOT NULL DEFAULT 'RUB', "principalMinor" bigint NOT NULL, "annualRatePercent" numeric(5,2) NOT NULL, "termMonths" integer NOT NULL, "monthlyPaymentMinor" bigint, "issuedAt" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_45cea097fd0ee625d2e840ed99c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c528a2c2288add4989192d9cc9" ON "credits"  ("clientId") `);
        await queryRunner.query(`CREATE TABLE "clients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active', CONSTRAINT "PK_f1ab7cf3a5714dbc6bb4e1c28a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_ad038f1a0071dfcec8215129492" FOREIGN KEY ("installmentId") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_e71e2e3092300ddf79ca3602293" FOREIGN KEY ("creditId") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "installments" ADD CONSTRAINT "FK_948f7fb5ffc9373c7cc323c6282" FOREIGN KEY ("creditId") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credits" ADD CONSTRAINT "FK_c528a2c2288add4989192d9cc98" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credits" ADD CONSTRAINT "FK_9599ef0c64d9ccd1ae7578e3bd1" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credits" DROP CONSTRAINT "FK_9599ef0c64d9ccd1ae7578e3bd1"`);
        await queryRunner.query(`ALTER TABLE "credits" DROP CONSTRAINT "FK_c528a2c2288add4989192d9cc98"`);
        await queryRunner.query(`ALTER TABLE "installments" DROP CONSTRAINT "FK_948f7fb5ffc9373c7cc323c6282"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_e71e2e3092300ddf79ca3602293"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_ad038f1a0071dfcec8215129492"`);
        await queryRunner.query(`DROP TABLE "clients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c528a2c2288add4989192d9cc9"`);
        await queryRunner.query(`DROP TABLE "credits"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b655a95f22dc941f3c2c4e0a1"`);
        await queryRunner.query(`DROP TABLE "programs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_948f7fb5ffc9373c7cc323c628"`);
        await queryRunner.query(`DROP TABLE "installments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e71e2e3092300ddf79ca360229"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad038f1a0071dfcec821512949"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
