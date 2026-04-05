import type { Database } from "../types/database.js";
import {
  addMonthsUTC,
  dueDateInMonth,
  parseISODate,
  startOfMonthUTC,
  toISODate,
} from "../utils/dates.js";

type BudgetRow = Database["public"]["Tables"]["budget"]["Row"];
type OccRow = Database["public"]["Tables"]["budget_occurrence"]["Row"];

// TODO: Make sure this is getting created once in a month for whole month for every budget
export type MergedOccurrence = {
  budget_id: string;
  period_start: string;
  due_date: string;
  planned_amount_paise: number;
  actual_amount_paise: number | null;
  paid_at: string | null;
  note: string | null;
  source: "virtual" | "db";
  occurrence_id: string | null;
};

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * Pure: expand monthly budget into virtual occurrences between rangeStart and rangeEnd (inclusive by month).
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
  if (budget.recurrence !== "monthly") {
    return [];
  }

  const budgetStart = parseISODate(budget.start_date);
  const budgetStartPeriod = startOfMonthUTC(budgetStart.getUTCFullYear(), budgetStart.getUTCMonth());

  const rangeA = parseISODate(rangeStartISO);
  const rangeB = parseISODate(rangeEndISO);
  const rangeStartPeriod = startOfMonthUTC(rangeA.getUTCFullYear(), rangeA.getUTCMonth());
  const rangeEndPeriod = startOfMonthUTC(rangeB.getUTCFullYear(), rangeB.getUTCMonth());

  let iterStart = maxDate(budgetStartPeriod, rangeStartPeriod);
  let iterEnd = rangeEndPeriod;

  if (budget.recurrence_end_date) {
    const end = parseISODate(budget.recurrence_end_date);
    const endPeriod = startOfMonthUTC(end.getUTCFullYear(), end.getUTCMonth());
    iterEnd = minDate(iterEnd, endPeriod);
  }

  if (iterStart.getTime() > iterEnd.getTime()) {
    return [];
  }

  const out: Omit<MergedOccurrence, "source" | "occurrence_id">[] = [];

  for (let d = new Date(iterStart); d.getTime() <= iterEnd.getTime(); d = addMonthsUTC(d, 1)) {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const period_start = toISODate(startOfMonthUTC(y, m));
    const due = dueDateInMonth(y, m, budget.due_day_of_month);
    const due_date = toISODate(due);

    out.push({
      budget_id: budget.id,
      period_start,
      due_date,
      planned_amount_paise: budget.default_planned_amount_paise,
      actual_amount_paise: null,
      paid_at: null,
      note: null,
    });
  }

  return out;
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
