import type { Budget, BudgetOccurrence, Category, MoneyTransaction } from "@prisma/client";
import type { Database } from "../types/database.js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toCategoryRow(c: Category): Database["public"]["Tables"]["category"]["Row"] {
  return {
    id: c.id,
    user_id: c.user_id,
    title: c.title,
    image_url: c.image_url,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

export function toBudgetRow(b: Budget): Database["public"]["Tables"]["budget"]["Row"] {
  return {
    id: b.id,
    user_id: b.user_id,
    category_id: b.category_id,
    title: b.title,
    default_planned_amount_paise: Number(b.default_planned_amount_paise),
    start_date: isoDate(b.start_date),
    recurrence_end_date: b.recurrence_end_date ? isoDate(b.recurrence_end_date) : null,
    due_day_of_month: b.due_day_of_month,
    recurrence: b.recurrence,
    created_at: b.created_at.toISOString(),
    updated_at: b.updated_at.toISOString(),
  };
}

export function toBudgetOccurrenceRow(
  o: BudgetOccurrence
): Database["public"]["Tables"]["budget_occurrence"]["Row"] {
  return {
    id: o.id,
    budget_id: o.budget_id,
    period_start: isoDate(o.period_start),
    planned_amount_paise:
      o.planned_amount_paise === null ? null : Number(o.planned_amount_paise),
    actual_amount_paise:
      o.actual_amount_paise === null ? null : Number(o.actual_amount_paise),
    paid_at: o.paid_at ? o.paid_at.toISOString() : null,
    note: o.note,
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  };
}

export function toMoneyTransactionRow(
  t: MoneyTransaction
): Database["public"]["Tables"]["money_transaction"]["Row"] {
  return {
    id: t.id,
    user_id: t.user_id,
    type: t.type,
    amount_paise: Number(t.amount_paise),
    occurred_at: isoDate(t.occurred_at),
    category_id: t.category_id,
    note: t.note,
    budget_occurrence_id: t.budget_occurrence_id,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

export function parseISODateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
