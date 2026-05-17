import { prisma } from "../lib/prisma.js";
import { parseISODateOnly, toTransactionRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import type { Database, TransactionType } from "../types/database.js";
import { materializeNextOccurrenceAfterSettled } from "../services/budgetMaterializationService.js";

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

  async create(row: Database["public"]["Tables"]["transaction"]["Insert"]) {
    const data = {
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
      budget_occurrence_id: row.budget_occurrence_id ?? null,
      bank_account_id: row.bank_account_id ?? null,
      card_id: row.card_id ?? null,
      upi_profile_id: row.upi_profile_id ?? null,
    };

    if (!row.budget_occurrence_id) {
      const created = await prisma.transaction.create({ data });
      return toTransactionRow(created);
    }

    const createdRow = await prisma.$transaction(async (trx) => {
      const created = await trx.transaction.create({ data });

      const occ = await trx.budgetOccurrence.findUnique({
        where: { id: row.budget_occurrence_id! },
        include: { budget: true },
      });
      if (!occ || occ.project_id !== row.project_id) {
        const err = new Error("Invalid budget_occurrence_id for this project");
        (err as Error & { status?: number }).status = 400;
        throw err;
      }
      if (occ.schedule_status === "DONE" && occ.settled_transaction_id) {
        const err = new Error("Occurrence already settled");
        (err as Error & { status?: number }).status = 409;
        throw err;
      }

      await trx.budgetOccurrence.update({
        where: { id: occ.id },
        data: {
          schedule_status: "DONE",
          settled_transaction_id: created.id,
          projected_transaction_id: null,
        },
      });

      const settledPeriodIso = occ.period_start.toISOString().slice(0, 10);
      await materializeNextOccurrenceAfterSettled(trx, occ.budget, row.project_id, settledPeriodIso);

      return created;
    });

    return toTransactionRow(createdRow);
  }

  async sumByTypeInMonth(projectId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const rows = await prisma.transaction.findMany({
      where: {
        project_id: projectId,
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
