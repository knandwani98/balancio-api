import type { Prisma } from "@prisma/client";
import type { Budget } from "@prisma/client";
import type { Database, TransactionType } from "../types/database.js";
import { computeOccurrences } from "./budgetOccurrenceService.js";
import { addMonthsUTC, parseISODate, toISODate, utcTodayISO } from "../utils/dates.js";
import { budgetPaymentForTransaction, parseISODateOnly, toBudgetRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import { prisma } from "../lib/prisma.js";

type VirtualOccurrence = Omit<
  import("./budgetOccurrenceService.js").MergedOccurrence,
  "source" | "occurrence_id"
>;

/** Occurrences whose due date has passed (inclusive) as of `todayIso`. */
export function occurrencesToSettleOnCreate(
  virtual: VirtualOccurrence[],
  todayIso: string
): VirtualOccurrence[] {
  return virtual.filter((v) => v.due_date <= todayIso);
}

/**
 * On budget create: persist cleared transactions for every period from start_date through today,
 * then materialize the next pending period.
 */
export async function backfillBudgetOccurrencesOnCreate(
  budget: Database["public"]["Tables"]["budget"]["Row"],
  userId: string,
  transactionType: TransactionType
): Promise<void> {
  const todayIso = utcTodayISO();
  const virtual = computeOccurrences(budget, budget.start_date, todayIso);
  const toSettle = occurrencesToSettleOnCreate(virtual, todayIso);

  await prisma.$transaction(async (trx) => {
    for (const occ of toSettle) {
      await upsertBudgetPeriodTransaction(trx, budget, userId, transactionType, occ, "cleared");
    }

    const budgetEntity = await trx.budget.findUnique({ where: { id: budget.id } });
    if (!budgetEntity) return;

    const lastSettled = toSettle[toSettle.length - 1];
    if (lastSettled) {
      await materializeNextBudgetPeriodAfterSettled(
        trx,
        budgetEntity,
        budget.project_id,
        lastSettled.period_start,
        userId,
        transactionType
      );
      return;
    }

    await materializeFirstPendingBudgetPeriod(trx, budget, userId, transactionType);
  });
}

async function upsertBudgetPeriodTransaction(
  trx: Prisma.TransactionClient,
  budget: Database["public"]["Tables"]["budget"]["Row"],
  userId: string,
  transactionType: TransactionType,
  occ: VirtualOccurrence,
  lineStatus: "pending" | "cleared"
): Promise<void> {
  const period = parseISODateOnly(occ.period_start);
  const dueDate = parseISODateOnly(occ.due_date);

  const existing = await trx.transaction.findUnique({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
  });
  if (existing?.line_status === "cleared") return;

  const payment = budgetPaymentForTransaction(budget);

  await trx.transaction.upsert({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
    create: {
      project_id: budget.project_id,
      created_by_user_id: userId,
      user_id: userId,
      type: transactionType,
      name: budget.title,
      amount: toPrismaDecimal(occ.planned_amount),
      line_status: lineStatus,
      payment_method: payment.payment_method,
      occurred_at: dueDate,
      category_id: budget.category_id,
      note: null,
      budget_id: budget.id,
      period_start: period,
      due_date: dueDate,
      bank_account_id: payment.bank_account_id,
      card_id: payment.card_id,
    },
    update: {
      due_date: dueDate,
      amount: toPrismaDecimal(occ.planned_amount),
      line_status: lineStatus,
      occurred_at: dueDate,
    },
  });
}

async function materializeFirstPendingBudgetPeriod(
  trx: Prisma.TransactionClient,
  budget: Database["public"]["Tables"]["budget"]["Row"],
  userId: string,
  transactionType: TransactionType
): Promise<void> {
  const farEnd = addMonthsUTC(parseISODate(budget.start_date), 120);
  const virtual = computeOccurrences(budget, budget.start_date, toISODate(farEnd));
  const first = virtual[0];
  if (!first) return;
  await upsertBudgetPeriodTransaction(trx, budget, userId, transactionType, first, "pending");
}

/**
 * After a budget period is cleared, ensure the next period exists as a pending transaction.
 */
export async function materializeNextBudgetPeriodAfterSettled(
  db: Prisma.TransactionClient,
  budget: Budget,
  projectId: string,
  settledPeriodStartIso: string,
  userId: string,
  transactionType: TransactionType
): Promise<void> {
  const budgetRow = toBudgetRow(budget);
  const farEnd = addMonthsUTC(parseISODate(budgetRow.start_date), 120);
  const farIso = toISODate(farEnd);
  const virtual = computeOccurrences(budgetRow, budgetRow.start_date, farIso);
  const next = virtual.find((v) => v.period_start > settledPeriodStartIso);
  if (!next) return;

  const period = parseISODateOnly(next.period_start);
  const dueDate = parseISODateOnly(next.due_date);

  const existing = await db.transaction.findUnique({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
  });
  if (existing?.line_status === "cleared") return;

  const payment = budgetPaymentForTransaction(budgetRow);

  await db.transaction.upsert({
    where: {
      budget_id_period_start: {
        budget_id: budget.id,
        period_start: period,
      },
    },
    create: {
      project_id: projectId,
      created_by_user_id: userId,
      user_id: userId,
      type: transactionType,
      name: budget.title,
      amount: toPrismaDecimal(next.planned_amount),
      line_status: "pending",
      payment_method: payment.payment_method,
      occurred_at: dueDate,
      category_id: budget.category_id,
      note: null,
      budget_id: budget.id,
      period_start: period,
      due_date: dueDate,
      bank_account_id: payment.bank_account_id,
      card_id: payment.card_id,
    },
    update: {
      due_date: dueDate,
      line_status: "pending",
      amount: toPrismaDecimal(next.planned_amount),
      occurred_at: dueDate,
    },
  });
}
