import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseISODateOnly, toBudgetRow } from "../lib/prismaMappers.js";
import { toPrismaDecimal } from "../lib/money.js";
import type { Database } from "../types/database.js";

export class BudgetRepository {
  async list(projectId: string): Promise<Database["public"]["Tables"]["budget"]["Row"][]> {
    const rows = await prisma.budget.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
    return rows.map(toBudgetRow);
  }

  async getById(projectId: string, id: string) {
    const row = await prisma.budget.findFirst({
      where: { project_id: projectId, id },
    });
    return row ? toBudgetRow(row) : null;
  }

  async create(
    projectId: string,
    createdByUserId: string,
    input: Omit<Database["public"]["Tables"]["budget"]["Insert"], "project_id" | "created_by_user_id">
  ) {
    const row = await prisma.budget.create({
      data: {
        project_id: projectId,
        created_by_user_id: createdByUserId,
        category_id: input.category_id,
        title: input.title,
        default_planned_amount: toPrismaDecimal(input.default_planned_amount),
        start_date: parseISODateOnly(input.start_date),
        recurrence_end_date: input.recurrence_end_date
          ? parseISODateOnly(input.recurrence_end_date)
          : null,
        due_day_of_occurence: input.due_day_of_occurence,
        recurrence: input.recurrence ?? "monthly",
        payment_method: input.payment_method ?? "cash",
        bank_account_id: input.bank_account_id ?? null,
        card_id: input.card_id ?? null,
      },
    });
    return toBudgetRow(row);
  }

  async update(
    projectId: string,
    id: string,
    patch: Database["public"]["Tables"]["budget"]["Update"]
  ) {
    const owned = await prisma.budget.findFirst({
      where: { id, project_id: projectId },
    });
    if (!owned) return null;

    const data: Prisma.BudgetUncheckedUpdateInput = {};
    if (patch.category_id !== undefined) data.category_id = patch.category_id;
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.default_planned_amount !== undefined) {
      data.default_planned_amount = toPrismaDecimal(patch.default_planned_amount);
    }
    if (patch.start_date !== undefined) data.start_date = parseISODateOnly(patch.start_date);
    if (patch.recurrence_end_date !== undefined) {
      data.recurrence_end_date =
        patch.recurrence_end_date === null ? null : parseISODateOnly(patch.recurrence_end_date);
    }
    if (patch.due_day_of_occurence !== undefined) data.due_day_of_occurence = patch.due_day_of_occurence;
    if (patch.recurrence !== undefined) data.recurrence = patch.recurrence;
    if (patch.payment_method !== undefined) data.payment_method = patch.payment_method;
    if (patch.bank_account_id !== undefined) data.bank_account_id = patch.bank_account_id;
    if (patch.card_id !== undefined) data.card_id = patch.card_id;

    const row = await prisma.budget.update({
      where: { id },
      data,
    });
    return toBudgetRow(row);
  }

  async delete(projectId: string, id: string) {
    await prisma.budget.deleteMany({
      where: { project_id: projectId, id },
    });
  }
}
