import type { InvestmentPlan, PlanTimelinePoint } from "@prisma/client";
import { parseISODateOnly } from "../lib/prismaMappers.js";
import { addDaysUTC, dayBeforeUTC } from "./planAllocationMath.js";

export function assertEffectiveFromInPlan(
  plan: Pick<InvestmentPlan, "start_date" | "end_date">,
  effectiveFrom: Date
): void {
  const fromMs = effectiveFrom.getTime();
  if (fromMs < plan.start_date.getTime()) {
    throw new Error("Timeline point must be on or after plan start date");
  }
  if (plan.end_date && fromMs > plan.end_date.getTime()) {
    throw new Error("Timeline point must be on or before plan end date");
  }
}

export function assertEffectiveFromAfterPrior(
  priorPoints: Pick<PlanTimelinePoint, "effective_from">[],
  effectiveFrom: Date
): void {
  if (priorPoints.length === 0) return;
  const latest = priorPoints.reduce((a, b) =>
    a.effective_from.getTime() > b.effective_from.getTime() ? a : b
  );
  if (effectiveFrom.getTime() <= latest.effective_from.getTime()) {
    throw new Error("Timeline point must be after existing points");
  }
}

/** Close the open-ended point before a new one starts. */
export function effectiveToBeforeNewPoint(newPointFrom: Date): Date {
  return dayBeforeUTC(newPointFrom);
}

/** effective_to for each point: day before next point starts, or plan end for the last segment. */
export function computeTimelineEffectiveToChain(
  sortedPoints: { id: string; effective_from: Date }[],
  planEnd: Date | null
): Map<string, Date | null> {
  const chain = new Map<string, Date | null>();
  for (let i = 0; i < sortedPoints.length; i++) {
    const current = sortedPoints[i]!;
    const next = sortedPoints[i + 1];
    const effective_to = next
      ? capEffectiveToToPlanEnd(effectiveToBeforeNewPoint(next.effective_from), planEnd)
      : planEnd;
    chain.set(current.id, effective_to);
  }
  return chain;
}

export function assertEffectiveFromBetweenSiblings(
  sortedPoints: { id: string; effective_from: Date }[],
  pointId: string,
  effectiveFrom: Date
): void {
  const idx = sortedPoints.findIndex((p) => p.id === pointId);
  if (idx < 0) return;
  const prev = idx > 0 ? sortedPoints[idx - 1] : null;
  const next = idx < sortedPoints.length - 1 ? sortedPoints[idx + 1] : null;
  if (prev && effectiveFrom.getTime() <= prev.effective_from.getTime()) {
    throw new Error("Timeline point must be after the previous point");
  }
  if (next && effectiveFrom.getTime() >= next.effective_from.getTime()) {
    throw new Error("Timeline point must be before the next point");
  }
}

export function parseEffectiveFrom(iso: string): Date {
  return parseISODateOnly(iso);
}

export function capEffectiveToToPlanEnd(
  effectiveTo: Date | null,
  planEnd: Date | null
): Date | null {
  if (!planEnd) return effectiveTo;
  if (!effectiveTo) return planEnd;
  return effectiveTo.getTime() > planEnd.getTime() ? planEnd : effectiveTo;
}

/** After deleting a point, set previous point's effective_to. */
export function healEffectiveToAfterDelete(
  sortedPoints: Pick<PlanTimelinePoint, "id" | "effective_from" | "effective_to">[],
  deletedId: string,
  planEnd: Date | null
): { pointId: string; effective_to: Date | null } | null {
  const idx = sortedPoints.findIndex((p) => p.id === deletedId);
  if (idx < 0) return null;
  const prev = idx > 0 ? sortedPoints[idx - 1] : null;
  const next = idx < sortedPoints.length - 1 ? sortedPoints[idx + 1] : null;
  if (!prev) return null;
  const effective_to = next
    ? capEffectiveToToPlanEnd(dayBeforeUTC(next.effective_from), planEnd)
    : planEnd;
  return { pointId: prev.id, effective_to };
}

export function initialPointEffectiveFrom(
  planStart: Date,
  requestedFrom: Date | undefined
): Date {
  if (!requestedFrom) return planStart;
  if (requestedFrom.getTime() < planStart.getTime()) {
    throw new Error("Initial timeline point must be on or after plan start date");
  }
  return requestedFrom;
}

export function formatDateRange(
  from: Date,
  to: Date | null
): { effective_from: string; effective_to: string | null } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { effective_from: iso(from), effective_to: to ? iso(to) : null };
}

export { addDaysUTC };
