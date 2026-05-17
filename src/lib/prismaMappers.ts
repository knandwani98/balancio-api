import type {
  Budget,
  BudgetOccurrence,
  Category,
  Goal,
  Transaction,
} from "@prisma/client";
import type { Database } from "../types/database.js";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toCategoryRow(c: Category): Database["public"]["Tables"]["category"]["Row"] {
  return {
    id: c.id,
    project_id: c.project_id,
    name: c.name,
    icon: c.icon,
    kind: c.kind,
    created_by_user_id: c.created_by_user_id,
    created_at: c.created_at.toISOString(),
    updated_at: c.updated_at.toISOString(),
  };
}

export function toBudgetRow(b: Budget): Database["public"]["Tables"]["budget"]["Row"] {
  return {
    id: b.id,
    project_id: b.project_id,
    created_by_user_id: b.created_by_user_id,
    category_id: b.category_id,
    title: b.title,
    default_planned_amount: b.default_planned_amount.toNumber(),
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
    project_id: o.project_id,
    period_start: isoDate(o.period_start),
    due_date: isoDate(o.due_date),
    schedule_status: o.schedule_status,
    planned_amount:
      o.planned_amount === null ? null : o.planned_amount.toNumber(),
    actual_amount:
      o.actual_amount === null ? null : o.actual_amount.toNumber(),
    paid_at: o.paid_at ? o.paid_at.toISOString() : null,
    note: o.note,
    projected_transaction_id: o.projected_transaction_id,
    settled_transaction_id: o.settled_transaction_id,
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  };
}

/** JSON-serializable goal row (BigInt / Decimal → number). */
export function toGoalRow(g: Goal) {
  return {
    id: g.id,
    project_id: g.project_id,
    created_by_user_id: g.created_by_user_id,
    name: g.name,
    amount: g.amount.toNumber(),
    frequency: g.frequency,
    tenure_mode: g.tenure_mode,
    fixed_days: g.fixed_days,
    aim_amount: g.aim_amount == null ? null : g.aim_amount.toNumber(),
    source: g.source,
    interest_rate_pa: g.interest_rate_pa != null ? Number(g.interest_rate_pa) : null,
    start_date: g.start_date ? isoDate(g.start_date) : null,
    maturity_date: g.maturity_date ? isoDate(g.maturity_date) : null,
    linked_bank_account_id: g.linked_bank_account_id,
    is_archived: g.is_archived,
    created_at: g.created_at.toISOString(),
    updated_at: g.updated_at.toISOString(),
  };
}

export function toTransactionRow(
  t: Transaction
): Database["public"]["Tables"]["transaction"]["Row"] {
  return {
    id: t.id,
    project_id: t.project_id,
    created_by_user_id: t.created_by_user_id,
    user_id: t.user_id,
    type: t.type,
    name: t.name,
    amount: t.amount.toNumber(),
    line_status: t.line_status,
    payment_method: t.payment_method,
    occurred_at: isoDate(t.occurred_at),
    category_id: t.category_id,
    note: t.note,
    budget_occurrence_id: t.budget_occurrence_id,
    bank_account_id: t.bank_account_id,
    card_id: t.card_id,
    upi_profile_id: t.upi_profile_id,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

export function parseISODateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
