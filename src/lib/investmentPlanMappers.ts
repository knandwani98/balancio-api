import type { PlanWithPoints } from "../repositories/investmentPlanRepository.js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pointAmountNumber(p: PlanWithPoints["points"][0]): number {
  return p.period_amount.toNumber();
}

/** Latest timeline point by effective_from. */
export function latestTimelinePoint(
  plan: Pick<PlanWithPoints, "points">
): PlanWithPoints["points"][0] | null {
  if (plan.points.length === 0) return null;
  return [...plan.points].sort(
    (a, b) => a.effective_from.getTime() - b.effective_from.getTime()
  ).at(-1)!;
}

/** Current period total for list/cards (latest point, else plan default). */
export function currentPeriodAmount(plan: PlanWithPoints): number {
  const latest = latestTimelinePoint(plan);
  if (latest) return pointAmountNumber(latest);
  return plan.period_amount.toNumber();
}

export function toPlanFundRow(
  f: PlanWithPoints["points"][0]["funds"][0],
  pointTotal: number
) {
  const percentage = f.percentage.toNumber();
  const computed_amount = Math.round(((pointTotal * percentage) / 100) * 10000) / 10000;
  return {
    id: f.id,
    name: f.name,
    percentage,
    input_mode: f.input_mode,
    frequency: f.frequency,
    schedule_day: f.schedule_day,
    computed_amount,
    sort_order: f.sort_order,
  };
}

export function toPlanPointRow(p: PlanWithPoints["points"][0]) {
  const pointTotal = pointAmountNumber(p);
  return {
    id: p.id,
    effective_from: isoDate(p.effective_from),
    effective_to: p.effective_to ? isoDate(p.effective_to) : null,
    period_amount: pointTotal,
    funds: p.funds.map((f) => toPlanFundRow(f, pointTotal)),
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}

type PlanListRow = {
  id: string;
  project_id: string;
  name: string;
  start_date: Date;
  end_date: Date | null;
  period_amount: { toNumber(): number };
  created_at: Date;
  updated_at: Date;
  points: { period_amount: { toNumber(): number } }[];
  holdings?: { current_value: { toNumber(): number }; invested: { toNumber(): number } }[];
  _count?: { points: number };
  point_count?: number;
};

function sumHoldings(
  holdings: { current_value: { toNumber(): number }; invested: { toNumber(): number } }[]
) {
  return holdings.reduce(
    (acc, h) => ({
      current_value: acc.current_value + h.current_value.toNumber(),
      invested: acc.invested + h.invested.toNumber(),
    }),
    { current_value: 0, invested: 0 }
  );
}

export function toPlanListSummaryRow(plan: PlanListRow) {
  const currentAmount =
    plan.points[0] != null
      ? plan.points[0].period_amount.toNumber()
      : plan.period_amount.toNumber();
  const pointCount =
    plan.point_count ?? ("_count" in plan && plan._count ? plan._count.points : plan.points.length);
  const holdings = sumHoldings(plan.holdings ?? []);
  return {
    id: plan.id,
    project_id: plan.project_id,
    name: plan.name,
    start_date: isoDate(plan.start_date),
    end_date: plan.end_date ? isoDate(plan.end_date) : null,
    period_amount: currentAmount,
    current_value: holdings.current_value,
    invested: holdings.invested,
    holding_count: (plan.holdings ?? []).length,
    point_count: pointCount,
    created_at: plan.created_at.toISOString(),
    updated_at: plan.updated_at.toISOString(),
  };
}

export function toPlanSummaryRow(plan: PlanWithPoints) {
  return toPlanListSummaryRow({
    ...plan,
    point_count: plan.points.length,
    points: plan.points.map((p) => ({ period_amount: p.period_amount })),
    holdings: plan.holdings,
  });
}

export function toPlanDetailRow(plan: PlanWithPoints) {
  const currentAmount = currentPeriodAmount(plan);
  return {
    ...toPlanSummaryRow(plan),
    period_amount: currentAmount,
    points: plan.points.map((p) => toPlanPointRow(p)),
  };
}
