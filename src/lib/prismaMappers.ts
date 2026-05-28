import type { Budget, Category, Goal, Transaction } from "@prisma/client";
import type { Database, PaymentMethod } from "../types/database.js";

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
    due_day_of_occurence: b.due_day_of_occurence,
    recurrence: b.recurrence,
    payment_method: b.payment_method,
    bank_account_id: b.bank_account_id,
    card_id: b.card_id,
    wallet_id: b.wallet_id,
    created_at: b.created_at.toISOString(),
    updated_at: b.updated_at.toISOString(),
  };
}

export function budgetPaymentForTransaction(
  budget: Database["public"]["Tables"]["budget"]["Row"]
): {
  payment_method: PaymentMethod;
  bank_account_id: string | null;
  card_id: string | null;
  wallet_id: string | null;
} {
  const pm = budget.payment_method ?? "cash";
  return {
    payment_method: pm,
    bank_account_id: pm === "bank" ? budget.bank_account_id : null,
    card_id: pm === "cards" ? budget.card_id : null,
    wallet_id: pm === "wallet" ? budget.wallet_id : null,
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
    budget_id: t.budget_id,
    due_date: t.due_date ? isoDate(t.due_date) : null,
    bank_account_id: t.bank_account_id,
    card_id: t.card_id,
    wallet_id: t.wallet_id,
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}

export function parseISODateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
