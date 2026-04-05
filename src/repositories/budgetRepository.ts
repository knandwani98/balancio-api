import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseISODateOnly, toBudgetRow } from "../lib/prismaMappers.js";
import type { Database } from "../types/database.js";

export class BudgetRepository {
  async list(userId: string): Promise<Database["public"]["Tables"]["budget"]["Row"][]> {
    const rows = await prisma.budget.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
    return rows.map(toBudgetRow);
  }

  async getById(userId: string, id: string) {
    const row = await prisma.budget.findFirst({
      where: { user_id: userId, id },
    });
    return row ? toBudgetRow(row) : null;
  }

  async create(
    userId: string,
    input: Omit<Database["public"]["Tables"]["budget"]["Insert"], "user_id">
  ) {
    const row = await prisma.budget.create({
      data: {
        user_id: userId,
        category_id: input.category_id,
        title: input.title,
        default_planned_amount_paise: BigInt(input.default_planned_amount_paise),
        start_date: parseISODateOnly(input.start_date),
        recurrence_end_date: input.recurrence_end_date
          ? parseISODateOnly(input.recurrence_end_date)
          : null,
        due_day_of_month: input.due_day_of_month,
        recurrence: input.recurrence ?? "monthly",
      },
    });
    return toBudgetRow(row);
  }

  async update(
    userId: string,
    id: string,
    patch: Database["public"]["Tables"]["budget"]["Update"]
  ) {
    const owned = await prisma.budget.findFirst({
      where: { id, user_id: userId },
    });
    if (!owned) return null;

    const data: Prisma.BudgetUncheckedUpdateInput = {};
    if (patch.category_id !== undefined) data.category_id = patch.category_id;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.default_planned_amount_paise !== undefined) {
      data.default_planned_amount_paise = BigInt(patch.default_planned_amount_paise);
    }
    if (patch.start_date !== undefined) data.start_date = parseISODateOnly(patch.start_date);
    if (patch.recurrence_end_date !== undefined) {
      data.recurrence_end_date =
        patch.recurrence_end_date === null ? null : parseISODateOnly(patch.recurrence_end_date);
    }
    if (patch.due_day_of_month !== undefined) data.due_day_of_month = patch.due_day_of_month;
    if (patch.recurrence !== undefined) data.recurrence = patch.recurrence;

    const row = await prisma.budget.update({
      where: { id },
      data,
    });
    return toBudgetRow(row);
  }

  async delete(userId: string, id: string) {
    await prisma.budget.deleteMany({
      where: { user_id: userId, id },
    });
  }
}
