-- Add fund-level frequency before removing plan-level frequency.
ALTER TABLE "plan_fund" ADD COLUMN "frequency" "BudgetRecurrence" NOT NULL DEFAULT 'monthly';

-- Preserve existing plan recurrence on each fund in that plan's timeline.
UPDATE "plan_fund" pf
SET "frequency" = ip."frequency"
FROM "plan_timeline_point" ptp
JOIN "investment_plan" ip ON ip."id" = ptp."plan_id"
WHERE pf."point_id" = ptp."id";

ALTER TABLE "investment_plan" DROP COLUMN "frequency";
