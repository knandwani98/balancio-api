-- AlterTable
ALTER TABLE "card" ADD COLUMN "credit_limit" DECIMAL(19,4);
ALTER TABLE "card" ADD COLUMN "statement_day" SMALLINT;
ALTER TABLE "card" ADD COLUMN "payment_day" SMALLINT;
