import type { BudgetRecurrence, Database, OccurrenceScheduleStatus } from "../types/database.js";
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
type OccRow = Database["public"]["Tables"]["budget_occurrence"]["Row"];

export type MergedOccurrence = {
  budget_id: string;
  period_start: string;
  due_date: string;
  planned_amount_paise: number;
  actual_amount_paise: number | null;
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
  budget: Pick<BudgetRow, "id" | "default_planned_amount_paise">,
  period_start: string,
  due_date: string,
  out: Omit<MergedOccurrence, "source" | "occurrence_id">[]
) {
  out.push({
    budget_id: budget.id,
    period_start,
    due_date,
    planned_amount_paise: budget.default_planned_amount_paise,
    actual_amount_paise: null,
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
    | "due_day_of_month"
    | "default_planned_amount_paise"
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
    const period_start = toISODate(startOfMonthUTC(y, m));
    const due = dueDateInMonth(y, m, budget.due_day_of_month);
    const due_date = toISODate(due);
    pushOccurrence(budget, period_start, due_date, out);
  }

  return out;
}

function computeWeeklyOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_month"
    | "default_planned_amount_paise"
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

  const dueOffsetDays = (budget.due_day_of_month - 1) % 7;
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

    pushOccurrence(budget, toISODate(mon), toISODate(due), out);
  }

  return out;
}

function computeDailyOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "default_planned_amount_paise"
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
    pushOccurrence(budget, iso, iso, out);
  }
  return out;
}

function computeOneTimeOccurrences(
  budget: Pick<
    BudgetRow,
    | "id"
    | "start_date"
    | "recurrence_end_date"
    | "due_day_of_month"
    | "default_planned_amount_paise"
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
  const period_start = toISODate(startOfMonthUTC(y, m));
  const due_date = toISODate(dueDateInMonth(y, m, budget.due_day_of_month));
  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];
  pushOccurrence(budget, period_start, due_date, out);
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
    | "due_day_of_month"
    | "default_planned_amount_paise"
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

export function mergeOccurrences(
  virtual: Omit<MergedOccurrence, "source" | "occurrence_id">[],
  dbRows: OccRow[]
): MergedOccurrence[] {
  const byPeriod = new Map<string, OccRow>();
  for (const r of dbRows) {
    byPeriod.set(r.period_start, r);
  }

  return virtual.map((v) => {
    const db = byPeriod.get(v.period_start);
    if (!db) {
      return {
        ...v,
        source: "virtual" as const,
        occurrence_id: null,
      };
    }
    const planned =
      db.planned_amount_paise != null ? db.planned_amount_paise : v.planned_amount_paise;
    return {
      budget_id: v.budget_id,
      period_start: v.period_start,
      due_date: v.due_date,
      planned_amount_paise: planned,
      actual_amount_paise: db.actual_amount_paise,
      paid_at: db.paid_at,
      note: db.note,
      schedule_status: db.schedule_status,
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
