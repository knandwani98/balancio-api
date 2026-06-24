-- DropForeignKey
ALTER TABLE "goal" DROP CONSTRAINT "goal_project_id_fkey";

-- DropForeignKey
ALTER TABLE "goal" DROP CONSTRAINT "goal_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "goal" DROP CONSTRAINT "goal_linked_bank_account_id_fkey";

-- AlterTable
ALTER TABLE "plan_fund" ADD COLUMN "schedule_day" INTEGER;

-- DropTable
DROP TABLE "goal";

-- DropEnum
DROP TYPE "GoalTenureMode";

-- CreateTable
CREATE TABLE "plan_holding" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "badge" TEXT NOT NULL,
    "badge_class_name" TEXT NOT NULL,
    "fund_type" TEXT NOT NULL DEFAULT 'index',
    "asset_type" TEXT NOT NULL DEFAULT 'equity',
    "asset_metal" TEXT,
    "asset_other_name" TEXT,
    "broker" TEXT NOT NULL DEFAULT 'zerodha',
    "broker_name" TEXT,
    "invested" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_nav" DECIMAL(19,6),
    "current_value" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "one_day_change" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "one_day_change_pct" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_holding_transaction" (
    "id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "txn_date" DATE NOT NULL,
    "nav" DECIMAL(19,6) NOT NULL,
    "units" DECIMAL(19,6) NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "invested" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_holding_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_holding_plan_id_idx" ON "plan_holding"("plan_id");

-- CreateIndex
CREATE INDEX "plan_holding_transaction_holding_id_txn_date_idx" ON "plan_holding_transaction"("holding_id", "txn_date");

-- AddForeignKey
ALTER TABLE "plan_holding" ADD CONSTRAINT "plan_holding_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "investment_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_holding_transaction" ADD CONSTRAINT "plan_holding_transaction_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "plan_holding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
