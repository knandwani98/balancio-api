import { Prisma } from "@prisma/client";
import type { BudgetRecurrence, PlanFundInputMode } from "@prisma/client";

export type PlanFundInput = {
  name: string;
  input_mode: PlanFundInputMode;
  value: number;
  frequency: BudgetRecurrence;
};

export type NormalizedPlanFund = {
  name: string;
  input_mode: PlanFundInputMode;
  percentage: number;
  computed_amount: number;
  frequency: BudgetRecurrence;
};

const PERCENT_SUM_TOLERANCE = 0.02;

export function normalizePlanFund(
  planTotal: number,
  item: PlanFundInput
): NormalizedPlanFund {
  if (planTotal <= 0) {
    throw new Error("Plan period amount must be greater than zero");
  }
  if (item.value <= 0) {
    throw new Error(`Fund "${item.name}" value must be greater than zero`);
  }

  let percentage: number;
  let computed_amount: number;

  if (item.input_mode === "percentage") {
    percentage = round4(item.value);
    computed_amount = round4((planTotal * percentage) / 100);
  } else {
    if (item.value > planTotal) {
      throw new Error(`Fund "${item.name}" amount exceeds plan total`);
    }
    computed_amount = round4(item.value);
    percentage = round4((computed_amount / planTotal) * 100);
  }

  return {
    name: item.name.trim(),
    input_mode: item.input_mode,
    percentage,
    computed_amount,
    frequency: item.frequency,
  };
}

export function validateNormalizedFunds(
  funds: NormalizedPlanFund[],
  planTotal: number
): void {
  if (funds.length === 0) {
    throw new Error("At least one fund is required");
  }
  const sumPct = round4(funds.reduce((s, f) => s + f.percentage, 0));
  if (Math.abs(sumPct - 100) > PERCENT_SUM_TOLERANCE) {
    throw new Error(`Fund allocations must sum to 100% (got ${sumPct.toFixed(2)}%)`);
  }
  const sumAmt = round4(funds.reduce((s, f) => s + f.computed_amount, 0));
  if (Math.abs(sumAmt - planTotal) > 0.05) {
    throw new Error(`Fund amounts must sum to plan total (got ${sumAmt})`);
  }
}

export function normalizeAndValidateFunds(
  planTotal: number,
  items: PlanFundInput[]
): NormalizedPlanFund[] {
  const normalized = items.map((item) => normalizePlanFund(planTotal, item));
  validateNormalizedFunds(normalized, planTotal);
  return normalized;
}

export function toPrismaPercentage(pct: number): Prisma.Decimal {
  return new Prisma.Decimal(String(round4(pct)));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function dayBeforeUTC(date: Date): Date {
  return addDaysUTC(date, -1);
}
