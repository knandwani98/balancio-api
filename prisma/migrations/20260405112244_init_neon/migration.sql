-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "BudgetRecurrence" AS ENUM ('monthly');

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "default_planned_amount_paise" BIGINT NOT NULL,
    "start_date" DATE NOT NULL,
    "recurrence_end_date" DATE,
    "due_day_of_month" SMALLINT NOT NULL,
    "recurrence" "BudgetRecurrence" NOT NULL DEFAULT 'monthly',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_occurrence" (
    "id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "planned_amount_paise" BIGINT,
    "actual_amount_paise" BIGINT,
    "paid_at" TIMESTAMPTZ(6),
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_transaction" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "occurred_at" DATE NOT NULL,
    "category_id" UUID,
    "note" TEXT,
    "budget_occurrence_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_user_id_idx" ON "category"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_user_id_title_key" ON "category"("user_id", "title");

-- CreateIndex
CREATE INDEX "budget_user_id_idx" ON "budget"("user_id");

-- CreateIndex
CREATE INDEX "budget_category_id_idx" ON "budget"("category_id");

-- CreateIndex
CREATE INDEX "budget_occurrence_budget_id_idx" ON "budget_occurrence"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_occurrence_budget_id_period_start_key" ON "budget_occurrence"("budget_id", "period_start");

-- CreateIndex
CREATE INDEX "money_transaction_user_id_idx" ON "money_transaction"("user_id");

-- CreateIndex
CREATE INDEX "money_transaction_occurred_at_idx" ON "money_transaction"("occurred_at");

-- CreateIndex
CREATE INDEX "money_transaction_category_id_idx" ON "money_transaction"("category_id");

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_occurrence" ADD CONSTRAINT "budget_occurrence_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_transaction" ADD CONSTRAINT "money_transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_transaction" ADD CONSTRAINT "money_transaction_budget_occurrence_id_fkey" FOREIGN KEY ("budget_occurrence_id") REFERENCES "budget_occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
