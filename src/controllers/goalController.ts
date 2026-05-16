import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { GoalRepository } from "../repositories/goalRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { createGoalSchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";
import { parseISODateOnly, toGoalRow } from "../lib/prismaMappers.js";

export function goalController(
  goals: GoalRepository,
  categories: CategoryRepository,
  projects: ProjectRepository
) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const p = await projects.getById(projectId);
      if (p) {
        await categories.ensureCanonicalSeed(projectId, p.created_by_user_id);
      }
      const rows = await goals.list(projectId);
      res.json(rows.map(toGoalRow));
    },

    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createGoalSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const row = await goals.create(projectId, req.userId, {
        name: d.name,
        amount_paise: BigInt(d.amount_paise),
        frequency: d.frequency,
        tenure_mode: d.tenure_mode,
        fixed_days: d.fixed_days ?? null,
        aim_amount_paise: d.aim_amount_paise != null ? BigInt(d.aim_amount_paise) : null,
        source: d.source,
        interest_rate_pa: d.interest_rate_pa ?? null,
        start_date: d.start_date ? parseISODateOnly(d.start_date) : null,
        maturity_date: d.maturity_date ? parseISODateOnly(d.maturity_date) : null,
        linked_bank_account_id: d.linked_bank_account_id ?? null,
      });
      res.status(201).json(toGoalRow(row));
    },

    remove: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      await goals.delete(projectId, String(req.params.goalId));
      res.status(204).send();
    },
  };
}
