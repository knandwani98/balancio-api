import { prisma } from "../lib/prisma.js";
import type { GoalTenureMode, BudgetRecurrence, PaymentMethod } from "@prisma/client";

export class GoalRepository {
  async list(projectId: string) {
    return prisma.goal.findMany({
      where: { project_id: projectId, is_archived: false },
      orderBy: { created_at: "desc" },
    });
  }

  async get(projectId: string, id: string) {
    return prisma.goal.findFirst({ where: { id, project_id: projectId } });
  }

  async create(
    projectId: string,
    createdByUserId: string,
    data: {
      name: string;
      amount_paise: bigint;
      frequency: BudgetRecurrence;
      tenure_mode: GoalTenureMode;
      fixed_days?: number | null;
      aim_amount_paise?: bigint | null;
      source: PaymentMethod;
      interest_rate_pa?: number | null;
      start_date?: Date | null;
      maturity_date?: Date | null;
      linked_bank_account_id?: string | null;
    }
  ) {
    return prisma.goal.create({
      data: {
        project_id: projectId,
        created_by_user_id: createdByUserId,
        name: data.name,
        amount_paise: data.amount_paise,
        frequency: data.frequency,
        tenure_mode: data.tenure_mode,
        fixed_days: data.fixed_days ?? null,
        aim_amount_paise: data.aim_amount_paise ?? null,
        source: data.source,
        interest_rate_pa: data.interest_rate_pa ?? null,
        start_date: data.start_date ?? null,
        maturity_date: data.maturity_date ?? null,
        linked_bank_account_id: data.linked_bank_account_id ?? null,
      },
    });
  }

  async update(projectId: string, id: string, patch: { is_archived?: boolean; name?: string }) {
    return prisma.goal.updateMany({
      where: { id, project_id: projectId },
      data: patch,
    });
  }

  async delete(projectId: string, id: string) {
    await prisma.goal.deleteMany({ where: { id, project_id: projectId } });
  }
}
