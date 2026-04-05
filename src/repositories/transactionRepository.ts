import { prisma } from "../lib/prisma.js";
import { parseISODateOnly, toMoneyTransactionRow } from "../lib/prismaMappers.js";
import type { Database, TransactionType } from "../types/database.js";

export class TransactionRepository {
  async list(
    userId: string,
    opts: { from?: string; to?: string; type?: TransactionType }
  ): Promise<Database["public"]["Tables"]["money_transaction"]["Row"][]> {
    const rows = await prisma.moneyTransaction.findMany({
      where: {
        user_id: userId,
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
    return rows.map(toMoneyTransactionRow);
  }

  async create(row: Database["public"]["Tables"]["money_transaction"]["Insert"]) {
    const created = await prisma.moneyTransaction.create({
      data: {
        user_id: row.user_id,
        type: row.type,
        amount_paise: BigInt(row.amount_paise),
        occurred_at: parseISODateOnly(row.occurred_at),
        category_id: row.category_id ?? null,
        note: row.note ?? null,
        budget_occurrence_id: row.budget_occurrence_id ?? null,
      },
    });
    return toMoneyTransactionRow(created);
  }

  async sumByTypeInMonth(userId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const rows = await prisma.moneyTransaction.findMany({
      where: {
        user_id: userId,
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { type: true, amount_paise: true },
    });

    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const n = Number(r.amount_paise);
      if (r.type === "income") income += n;
      else expense += n;
    }
    return { income_paise: income, expense_paise: expense };
  }

  async sumExpenseByCategoryInMonth(userId: string, year: number, monthIndex0: number) {
    const start = new Date(Date.UTC(year, monthIndex0, 1));
    const end = new Date(Date.UTC(year, monthIndex0 + 1, 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const rows = await prisma.moneyTransaction.findMany({
      where: {
        user_id: userId,
        type: "expense",
        occurred_at: {
          gte: parseISODateOnly(from),
          lte: parseISODateOnly(to),
        },
      },
      select: { category_id: true, amount_paise: true },
    });

    const map = new Map<string | null, number>();
    for (const r of rows) {
      const k = r.category_id;
      map.set(k, (map.get(k) ?? 0) + Number(r.amount_paise));
    }
    return map;
  }
}
