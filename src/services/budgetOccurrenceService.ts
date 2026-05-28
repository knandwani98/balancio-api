import type { BudgetRecurrence, Database, OccurrenceScheduleStatus } from "../types/database.js";
import { deriveScheduleStatus } from "./budgetSchedule.js";
import {
  addDaysUTC,
  addMonthsUTC,
  addWeeksUTC,
  dueDateInMonth,
  parseISODate,
  startOfISOWeekMondayUTC,
  startOfMonthUTC,
  toISODate,
} from "../utils/dates.js";

type BudgetRow = Database["public"]["Tables"]["budget"]["Row"];
/** Budget occurrence persisted as a transaction row (budget_id + due_date). */
export type BudgetOccurrenceRow = Database["public"]["Tables"]["transaction"]["Row"] & {
  budget_id: string;
  due_date: string;
};

export type MergedOccurrence = {
  budget_id: string;
  due_date: string;
  planned_amount: number;
  actual_amount: number | null;
  paid_at: string | null;
  note: string | null;
  schedule_status: OccurrenceScheduleStatus;
  source: "virtual" | "db";
  occurrence_id: string | null;
};

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function pushOccurrence(
  budget: Pick<BudgetRow, "id" | "default_planned_amount">,
  due_date: string,
  out: Omit<MergedOccurrence, "source" | "occurrence_id">[]
) {
  out.push({
    budget_id: budget.id,
    due_date,
    planned_amount: budget.default_planned_amount,
    actual_amount: null,
    paid_at: null,
    note: null,
    schedule_status: "PENDING",
  });
}

/** Month-based periods: anchor = first of budget start month; step 1 / 3 / 12 months. */
function computeSteppedMonthOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_occurence"
    | "default_planned_amount"
  >,
  rangeStartISO: string,
  rangeEndISO: string,
  stepMonths: number
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const budgetStart = parseISODate(budget.start_date);
  const anchor = startOfMonthUTC(budgetStart.getUTCFullYear(), budgetStart.getUTCMonth());

  const rangeA = parseISODate(rangeStartISO);
  const rangeB = parseISODate(rangeEndISO);
  const rangeStartPeriod = startOfMonthUTC(rangeA.getUTCFullYear(), rangeA.getUTCMonth());
  const rangeEndPeriod = startOfMonthUTC(rangeB.getUTCFullYear(), rangeB.getUTCMonth());

  let iterEnd = rangeEndPeriod;
  if (budget.recurrence_end_date) {
    const end = parseISODate(budget.recurrence_end_date);
    const endPeriod = startOfMonthUTC(end.getUTCFullYear(), end.getUTCMonth());
    iterEnd = minDate(iterEnd, endPeriod);
  }

  const minPeriod = maxDate(anchor, rangeStartPeriod);
  let d = new Date(anchor);
  while (d.getTime() < minPeriod.getTime()) {
    d = addMonthsUTC(d, stepMonths);
  }

  if (d.getTime() > iterEnd.getTime()) {
    return [];
  }

  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];

  for (; d.getTime() <= iterEnd.getTime(); d = addMonthsUTC(d, stepMonths)) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const due = dueDateInMonth(y, m, budget.due_day_of_occurence);
    const due_date = toISODate(due);
    if (due_date >= rangeStartISO && due_date <= rangeEndISO) {
      pushOccurrence(budget, due_date, out);
    }
  }

  return out;
}

function computeWeeklyOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_occurence"
    | "default_planned_amount"
  >,
  rangeStartISO: string,
  rangeEndISO: string
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const budgetStart = parseISODate(budget.start_date);
  const rangeA = parseISODate(rangeStartISO);
  const rangeB = parseISODate(rangeEndISO);

  let intervalEnd = rangeB;
  if (budget.recurrence_end_date) {
    intervalEnd = minDate(intervalEnd, parseISODate(budget.recurrence_end_date));
  }

  if (budgetStart.getTime() > intervalEnd.getTime()) {
    return [];
  }

  const intervalStart = maxDate(budgetStart, rangeA);
  if (intervalStart.getTime() > intervalEnd.getTime()) {
    return [];
  }

  const dueOffsetDays = (budget.due_day_of_occurence - 1) % 7;
  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];

  let mon = startOfISOWeekMondayUTC(intervalStart);
  const lastMondayBound = addDaysUTC(intervalEnd, 6);

  for (; mon.getTime() <= lastMondayBound.getTime(); mon = addWeeksUTC(mon, 1)) {
    const weekEnd = addDaysUTC(mon, 6);
    if (weekEnd.getTime() < intervalStart.getTime()) {
      continue;
    }
    if (mon.getTime() > intervalEnd.getTime()) {
      continue;
    }

    const due = addDaysUTC(mon, dueOffsetDays);
    if (due.getTime() < budgetStart.getTime() || due.getTime() > intervalEnd.getTime()) {
      continue;
    }

    const dueIso = toISODate(due);
    pushOccurrence(budget, dueIso, out);
  }

  return out;
}

function computeDailyOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "default_planned_amount"
  >,
  rangeStartISO: string,
  rangeEndISO: string
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const budgetStart = parseISODate(budget.start_date);
  const rangeA = parseISODate(rangeStartISO);
  const rangeB = parseISODate(rangeEndISO);

  let effEnd = rangeB;
  if (budget.recurrence_end_date) {
    effEnd = minDate(effEnd, parseISODate(budget.recurrence_end_date));
  }

  const effStart = maxDate(budgetStart, rangeA);
  if (effStart.getTime() > effEnd.getTime()) {
    return [];
  }

  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];
  for (let d = new Date(effStart); d.getTime() <= effEnd.getTime(); d = addDaysUTC(d, 1)) {
    const iso = toISODate(d);
    pushOccurrence(budget, iso, out);
  }
  return out;
}

function computeOneTimeOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_occurence"
    | "default_planned_amount"
  >,
  rangeStartISO: string,
  rangeEndISO: string
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const budgetStart = parseISODate(budget.start_date);
  const rangeA = parseISODate(rangeStartISO);
  const rangeB = parseISODate(rangeEndISO);
  if (budgetStart.getTime() < rangeA.getTime() || budgetStart.getTime() > rangeB.getTime()) {
    return [];
  }
  const y = budgetStart.getUTCFullYear();
  const m = budgetStart.getUTCMonth();
  const due_date = toISODate(dueDateInMonth(y, m, budget.due_day_of_occurence));
  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];
  pushOccurrence(budget, due_date, out);
  return out;
}

/**
 * Pure: expand budget into virtual occurrences between rangeStart and rangeEnd (UTC calendar dates).
 */
export function computeOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_occurence"
    | "default_planned_amount"
    | "recurrence"
  >,
  rangeStartISO: string,
  rangeEndISO: string
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const recurrence = budget.recurrence as BudgetRecurrence;
  switch (recurrence) {
    case "monthly":
      return computeSteppedMonthOccurrences(budget, rangeStartISO, rangeEndISO, 1);
    case "quarterly":
      return computeSteppedMonthOccurrences(budget, rangeStartISO, rangeEndISO, 3);
    case "half_yearly":
      return computeSteppedMonthOccurrences(budget, rangeStartISO, rangeEndISO, 6);
    case "yearly":
      return computeSteppedMonthOccurrences(budget, rangeStartISO, rangeEndISO, 12);
    case "weekly":
      return computeWeeklyOccurrences(budget, rangeStartISO, rangeEndISO);
    case "daily":
      return computeDailyOccurrences(budget, rangeStartISO, rangeEndISO);
    case "one_time":
      return computeOneTimeOccurrences(budget, rangeStartISO, rangeEndISO);
    default: {
      const _exhaustive: never = recurrence;
      return _exhaustive;
    }
  }
}

/** Map a persisted budget-occurrence transaction to API occurrence shape. */
export function mergedOccurrenceFromDbRow(
  budget: Pick<BudgetRow, "id" | "default_planned_amount" | "start_date" | "recurrence_end_date" | "due_day_of_occurence" | "recurrence">,
  db: BudgetOccurrenceRow
): MergedOccurrence {
  const virtual = computeOccurrences(budget as BudgetRow, db.due_date, db.due_date);
  const plannedFromSchedule = virtual[0]?.planned_amount ?? db.amount;
  const cleared = db.line_status === "cleared";
  return {
    budget_id: db.budget_id,
    due_date: db.due_date,
    planned_amount: cleared ? plannedFromSchedule : db.amount,
    actual_amount: cleared ? db.amount : null,
    paid_at: cleared ? `${db.occurred_at}T00:00:00.000Z` : null,
    note: db.note,
    schedule_status: deriveScheduleStatus(db.line_status, db.due_date),
    source: "db",
    occurrence_id: db.id,
  };
}

export function mergeOccurrences(
  virtual: Omit<MergedOccurrence, "source" | "occurrence_id">[],
  dbRows: BudgetOccurrenceRow[]
): MergedOccurrence[] {
  const byDueDate = new Map<string, BudgetOccurrenceRow>();
  for (const r of dbRows) {
    if (r.due_date) byDueDate.set(r.due_date, r);
  }

  return virtual.map((v) => {
    const db = byDueDate.get(v.due_date);
    if (!db) {
      return {
        ...v,
        source: "virtual" as const,
        occurrence_id: null,
      };
    }
    const cleared = db.line_status === "cleared";
    return {
      budget_id: v.budget_id,
      due_date: db.due_date,
      planned_amount: cleared ? v.planned_amount : db.amount,
      actual_amount: cleared ? db.amount : null,
      paid_at: cleared ? `${db.occurred_at}T00:00:00.000Z` : null,
      note: db.note,
      schedule_status: deriveScheduleStatus(db.line_status, db.due_date),
      source: "db",
      occurrence_id: db.id,
    };
  });
}

/** Occurrences whose due_date falls on targetDate (YYYY-MM-DD). */
export function occurrencesDueOn(
  budget: BudgetRow,
  targetDateISO: string
): Omit<MergedOccurrence, "source" | "occurrence_id">[] {
  const virtual = computeOccurrences(budget, targetDateISO, targetDateISO);
  return virtual.filter((o) => o.due_date === targetDateISO);
}
