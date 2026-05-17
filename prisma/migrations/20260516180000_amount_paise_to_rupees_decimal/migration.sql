-- Convert legacy integer minor-unit amounts to DECIMAL major units; neutral column names.

ALTER TABLE "budget" RENAME COLUMN "default_planned_amount_paise" TO "default_planned_amount";
ALTER TABLE "budget"
  ALTER COLUMN "default_planned_amount" TYPE DECIMAL(19, 4)
  USING ("default_planned_amount"::numeric / 100);

ALTER TABLE "budget_occurrence" RENAME COLUMN "planned_amount_paise" TO "planned_amount";
ALTER TABLE "budget_occurrence" RENAME COLUMN "actual_amount_paise" TO "actual_amount";
ALTER TABLE "budget_occurrence"
  ALTER COLUMN "planned_amount" TYPE DECIMAL(19, 4)
  USING (CASE WHEN "planned_amount" IS NULL THEN NULL ELSE "planned_amount"::numeric / 100 END);
ALTER TABLE "budget_occurrence"
  ALTER COLUMN "actual_amount" TYPE DECIMAL(19, 4)
  USING (CASE WHEN "actual_amount" IS NULL THEN NULL ELSE "actual_amount"::numeric / 100 END);

ALTER TABLE "transaction" RENAME COLUMN "amount_paise" TO "amount";
ALTER TABLE "transaction"
  ALTER COLUMN "amount" TYPE DECIMAL(19, 4)
  USING ("amount"::numeric / 100);

ALTER TABLE "goal" RENAME COLUMN "amount_paise" TO "amount";
ALTER TABLE "goal" RENAME COLUMN "aim_amount_paise" TO "aim_amount";
ALTER TABLE "goal"
  ALTER COLUMN "amount" TYPE DECIMAL(19, 4)
  USING ("amount"::numeric / 100);
ALTER TABLE "goal"
  ALTER COLUMN "aim_amount" TYPE DECIMAL(19, 4)
  USING (CASE WHEN "aim_amount" IS NULL THEN NULL ELSE "aim_amount"::numeric / 100 END);
