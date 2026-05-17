import type { Prisma } from "@prisma/client";
import type { Budget } from "@prisma/client";
import type { Database } from "../types/database.js";
import { computeOccurrences } from "./budgetOccurrenceService.js";
import type { BudgetOccurrenceRepository } from "../repositories/budgetOccurrenceRepository.js";
import { addMonthsUTC, parseISODate, toISODate } from "../utils/dates.js";
import { parseISODateOnly, toBudgetRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";

/** Persist the first projected budget occurrence (PENDING) after budget creation. */
export async function materializeFirstOccurrence(
  occurrences: BudgetOccurrenceRepository,
  budget: Database["public"]["Tables"]["budget"]["Row"]
): Promise<void> {
  const start = parseISODate(budget.start_date);
  const end = addMonthsUTC(start, 4);
  const from = budget.start_date;
  const to = toISODate(end);
  const virtual = computeOccurrences(budget, from, to);
  const first = virtual[0];
  if (!first) return;
  await occurrences.upsert(budget.id, budget.project_id, {
    period_start: first.period_start,
    due_date: first.due_date,
    schedule_status: "PENDING",
    planned_amount: first.planned_amount,
  });
}

/**
 * After an occurrence is settled (DONE), ensure the next period row exists as PENDING.
 * Uses the same virtual expansion as the UI merge logic.
 */
export async function materializeNextOccurrenceAfterSettled(
  db: Prisma.TransactionClient,
  budget: Budget,
  projectId: string,
  settledPeriodStartIso: string
): Promise<void> {
  const budgetRow = toBudgetRow(budget);
  const farEnd = addMonthsUTC(parseISODate(budgetRow.start_date), 120);
  const farIso = toISODate(farEnd);
  const virtual = computeOccurrences(budgetRow, budgetRow.start_date, farIso);
  const next = virtual.find((v) => v.period_start > settledPeriodStartIso);
  if (!next) return;

  const period = parseISODateOnly(next.period_start);
  const dueDate = parseISODateOnly(next.due_date);

  const existing = await db.budgetOccurrence.findUnique({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
  });
  if (existing?.schedule_status === "DONE" && existing.settled_transaction_id) {
    return;
  }

  await db.budgetOccurrence.upsert({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
    create: {
      budget_id: budget.id,
      project_id: projectId,
      period_start: period,
      due_date: dueDate,
      schedule_status: "PENDING",
      planned_amount: toPrismaDecimal(next.planned_amount),
      actual_amount: null,
      paid_at: null,
      note: null,
    },
    update: {
      due_date: dueDate,
      schedule_status: "PENDING",
      planned_amount: toPrismaDecimal(next.planned_amount),
      settled_transaction_id: null,
      projected_transaction_id: null,
    },
  });
}
