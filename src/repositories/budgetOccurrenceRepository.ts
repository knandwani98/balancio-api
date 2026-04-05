import { prisma } from "../lib/prisma.js";
import { parseISODateOnly, toBudgetOccurrenceRow } from "../lib/prismaMappers.js";
import type { Database } from "../types/database.js";

export class BudgetOccurrenceRepository {
  async getById(id: string) {
    const row = await prisma.budgetOccurrence.findUnique({ where: { id } });
    return row ? toBudgetOccurrenceRow(row) : null;
  }

  async listForBudgetInRange(
    budgetId: string,
    fromPeriod: string,
    toPeriod: string
  ): Promise<Database["public"]["Tables"]["budget_occurrence"]["Row"][]> {
    const rows = await prisma.budgetOccurrence.findMany({
      where: {
        budget_id: budgetId,
        period_start: {
          gte: parseISODateOnly(fromPeriod),
          lte: parseISODateOnly(toPeriod),
        },
      },
      orderBy: { period_start: "asc" },
    });
    return rows.map(toBudgetOccurrenceRow);
  }

  async getByBudgetAndPeriod(budgetId: string, periodStart: string) {
    const row = await prisma.budgetOccurrence.findUnique({
      where: {
        budget_id_period_start: {
          budget_id: budgetId,
          period_start: parseISODateOnly(periodStart),
        },
      },
    });
    return row ? toBudgetOccurrenceRow(row) : null;
  }

  async upsert(
    budgetId: string,
    row: {
      period_start: string;
      planned_amount_paise?: number | null;
      actual_amount_paise?: number | null;
      paid_at?: string | null;
      note?: string | null;
    }
  ) {
    const existing = await this.getByBudgetAndPeriod(budgetId, row.period_start);
    const planned =
      row.planned_amount_paise !== undefined
        ? row.planned_amount_paise
        : (existing?.planned_amount_paise ?? null);
    const actual =
      row.actual_amount_paise !== undefined
        ? row.actual_amount_paise
        : (existing?.actual_amount_paise ?? null);
    const paid =
      row.paid_at !== undefined ? row.paid_at : (existing?.paid_at ?? null);
    const note = row.note !== undefined ? row.note : (existing?.note ?? null);

    const period = parseISODateOnly(row.period_start);

    const upserted = await prisma.budgetOccurrence.upsert({
      where: {
        budget_id_period_start: {
          budget_id: budgetId,
          period_start: period,
        },
      },
      create: {
        budget_id: budgetId,
        period_start: period,
        planned_amount_paise: planned === null ? null : BigInt(planned),
        actual_amount_paise: actual === null ? null : BigInt(actual),
        paid_at: paid ? new Date(paid) : null,
        note,
      },
      update: {
        planned_amount_paise: planned === null ? null : BigInt(planned),
        actual_amount_paise: actual === null ? null : BigInt(actual),
        paid_at: paid ? new Date(paid) : null,
        note,
      },
    });

    return toBudgetOccurrenceRow(upserted);
  }
}
