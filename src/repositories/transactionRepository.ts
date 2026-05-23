import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { budgetPaymentForTransaction, parseISODateOnly, toTransactionRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import type {
  Database,
  PaymentMethod,
  TransactionLineStatus,
  TransactionType,
} from "../types/database.js";
import type { BudgetPeriodRow } from "../services/budgetOccurrenceService.js";
import {
  materializeNextBudgetPeriodAfterSettled,
} from "../services/budgetMaterializationService.js";

export class TransactionRepository {
  async list(
    projectId: string,
    opts: { from?: string; to?: string; type?: TransactionType }
  ): Promise<Database["public"]["Tables"]["transaction"]["Row"][]> {
    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        ...(opts.from || opts.to
          ? {
              occurred_at: {
                ...(opts.from ? { gte: parseISODateOnly(opts.from) } : {}),
                ...(opts.to ? { lte: parseISODateOnly(opts.to) } : {}),
              },
            }
          : {}),
        ...(opts.type ? { type: opts.type } : {}),
      },
      orderBy: { occurred_at: "desc" },
    });
    return rows.map(toTransactionRow);
  }

  async listBudgetPeriodsInRange(
    budgetId: string,
    fromPeriod: string,
    toPeriod: string
  ): Promise<BudgetPeriodRow[]> {
    const rows = await prisma.transaction.findMany({
      where: {
        budget_id: budgetId,
        period_start: {
          gte: parseISODateOnly(fromPeriod),
          lte: parseISODateOnly(toPeriod),
        },
      },
      orderBy: { period_start: "asc" },
    });
    return rows
      .filter((r): r is typeof r & { budget_id: string; period_start: Date; due_date: Date } =>
        Boolean(r.budget_id && r.period_start && r.due_date)
      )
      .map((r) => {
        const row = toTransactionRow(r);
        return {
          ...row,
          budget_id: r.budget_id!,
          period_start: row.period_start!,
          due_date: row.due_date!,
        };
      });
  }

  async getBudgetPeriodByBudgetAndPeriod(budgetId: string, periodStart: string) {
    const row = await prisma.transaction.findUnique({
      where: {
        budget_id_period_start: {
          budget_id: budgetId,
          period_start: parseISODateOnly(periodStart),
        },
      },
    });
    if (!row?.budget_id || !row.period_start || !row.due_date) return null;
    const mapped = toTransactionRow(row);
    return {
      ...mapped,
      budget_id: row.budget_id,
      period_start: mapped.period_start!,
      due_date: mapped.due_date!,
    } satisfies BudgetPeriodRow;
  }

  async upsertBudgetPeriod(
    budget: Database["public"]["Tables"]["budget"]["Row"],
    projectId: string,
    userId: string,
    transactionType: TransactionType,
    row: {
      period_start: string;
      due_date: string;
      planned_amount?: number | null;
      actual_amount?: number | null;
      note?: string | null;
      line_status?: TransactionLineStatus;
    }
  ): Promise<BudgetPeriodRow> {
    const existing = await this.getBudgetPeriodByBudgetAndPeriod(budget.id, row.period_start);
    const planned =
      row.planned_amount !== undefined && row.planned_amount !== null
        ? row.planned_amount
        : (existing?.amount ?? budget.default_planned_amount);
    const actual =
      row.actual_amount !== undefined ? row.actual_amount : existing?.line_status === "cleared"
        ? existing.amount
        : null;
    const cleared =
      row.line_status === "cleared" ||
      (actual !== null && actual !== undefined && row.actual_amount !== undefined);
    const amount = cleared && actual != null ? actual : planned;
    const lineStatus: TransactionLineStatus =
      row.line_status ?? (cleared ? "cleared" : (existing?.line_status ?? "pending"));
    const dueDate = parseISODateOnly(row.due_date);
    const period = parseISODateOnly(row.period_start);
    const note = row.note !== undefined ? row.note : (existing?.note ?? null);
    const payment = budgetPaymentForTransaction(budget);

    const upserted = await prisma.$transaction(async (trx) => {
      const saved = await trx.transaction.upsert({
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
          amount: toPrismaDecimal(amount),
          line_status: lineStatus,
          payment_method: payment.payment_method,
          occurred_at: dueDate,
          category_id: budget.category_id,
          note,
          budget_id: budget.id,
          period_start: period,
          due_date: dueDate,
          bank_account_id: payment.bank_account_id,
          card_id: payment.card_id,
        },
        update: {
          due_date: dueDate,
          amount: toPrismaDecimal(amount),
          line_status: lineStatus,
          note,
          occurred_at: dueDate,
        },
      });

      if (lineStatus === "cleared" && existing?.line_status !== "cleared") {
        const budgetEntity = await trx.budget.findUnique({ where: { id: budget.id } });
        if (budgetEntity) {
          await materializeNextBudgetPeriodAfterSettled(
            trx,
            budgetEntity,
            projectId,
            row.period_start,
            userId,
            transactionType
          );
        }
      }

      return saved;
    });

    const mapped = toTransactionRow(upserted);
    return {
      ...mapped,
      budget_id: upserted.budget_id!,
      period_start: mapped.period_start!,
      due_date: mapped.due_date!,
    };
  }

  async create(row: Database["public"]["Tables"]["transaction"]["Insert"]) {
    const data: Prisma.TransactionUncheckedCreateInput = {
      project_id: row.project_id,
      created_by_user_id: row.created_by_user_id,
      user_id: row.user_id,
      type: row.type,
      name: row.name,
      amount: toPrismaDecimal(row.amount),
      line_status: row.line_status ?? "pending",
      payment_method: row.payment_method ?? "cash",
      occurred_at: parseISODateOnly(row.occurred_at),
      category_id: row.category_id ?? null,
      note: row.note ?? null,
      budget_id: row.budget_id ?? null,
      period_start: row.period_start ? parseISODateOnly(row.period_start) : null,
      due_date: row.due_date ? parseISODateOnly(row.due_date) : null,
      bank_account_id: row.bank_account_id ?? null,
      card_id: row.card_id ?? null,
    };

    if (!row.budget_id) {
      const created = await prisma.transaction.create({ data });
      return toTransactionRow(created);
    }

    const createdRow = await prisma.$transaction(async (trx) => {
      const created = await trx.transaction.create({ data });

      if (created.line_status === "cleared" && created.period_start) {
        const budget = await trx.budget.findUnique({ where: { id: created.budget_id! } });
        if (budget) {
          const periodIso = created.period_start.toISOString().slice(0, 10);
          await materializeNextBudgetPeriodAfterSettled(
            trx,
            budget,
            row.project_id,
            periodIso,
            row.user_id,
            row.type
          );
        }
      }

      return created;
    });

    return toTransactionRow(createdRow);
  }

  async update(
    projectId: string,
    id: string,
    body: {
      type: TransactionType;
      name: string;
      amount: number;
      line_status?: TransactionLineStatus;
      payment_method?: PaymentMethod;
      occurred_at: string;
      category_id: string | null;
      note: string | null;
    }
  ) {
    const existing = await prisma.transaction.findFirst({
      where: { id, project_id: projectId },
    });
    if (!existing) return null;

    const nextStatus = body.line_status ?? existing.line_status;
    const wasCleared = existing.line_status === "cleared";
    const nowCleared = nextStatus === "cleared";

    const updated = await prisma.$transaction(async (trx) => {
      const row = await trx.transaction.update({
        where: { id },
        data: {
          type: body.type,
          name: body.name,
          amount: toPrismaDecimal(body.amount),
          line_status: nextStatus,
          payment_method: body.payment_method ?? existing.payment_method,
          occurred_at: parseISODateOnly(body.occurred_at),
          category_id: body.category_id,
          note: body.note,
        },
      });

      if (
        !wasCleared &&
        nowCleared &&
        row.budget_id &&
        row.period_start
      ) {
        const budget = await trx.budget.findUnique({ where: { id: row.budget_id } });
        if (budget) {
          await materializeNextBudgetPeriodAfterSettled(
            trx,
            budget,
            projectId,
            row.period_start.toISOString().slice(0, 10),
            row.user_id,
            row.type
          );
        }
      }

      return row;
    });

    return toTransactionRow(updated);
  }

  async remove(projectId: string, id: string): Promise<boolean> {
    const result = await prisma.transaction.deleteMany({
      where: { id, project_id: projectId },
    });
    return result.count > 0;
  }

  async sumByTypeInMonth(projectId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        line_status: "cleared",
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { type: true, amount: true },
    });

    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const n = r.amount.toNumber();
      if (r.type === "income") income += n;
      else expense += n;
    }
    return { income: income, expense: expense };
  }

  async sumExpenseByCategoryInMonth(projectId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
        type: "expense",
        line_status: "cleared",
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { category_id: true, amount: true },
    });

    const map = new Map<string | null, number>();
    for (const r of rows) {
      const k = r.category_id;
      map.set(k, (map.get(k) ?? 0) + r.amount.toNumber());
    }
    return map;
  }
}
