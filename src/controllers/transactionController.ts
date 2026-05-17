import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { BudgetOccurrenceRepository } from "../repositories/budgetOccurrenceRepository.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import { createTransactionSchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

export function transactionController(
  tx: TransactionRepository,
  categories: CategoryRepository,
  occurrences: BudgetOccurrenceRepository,
  budgets: BudgetRepository
) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const { from, to, type } = req.query;
      const rows = await tx.list(projectId, {
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
        type: type === "income" || type === "expense" ? type : undefined,
      });
      res.json(rows);
    },
    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createTransactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      if (body.category_id) {
        const cat = await categories.getById(projectId, body.category_id);
        if (!cat) {
          res.status(400).json({ error: "Invalid category_id" });
          return;
        }
      }

      if (body.budget_occurrence_id) {
        const occ = await occurrences.getById(body.budget_occurrence_id);
        if (!occ) {
          res.status(400).json({ error: "Invalid budget_occurrence_id" });
          return;
        }
        const b = await budgets.getById(projectId, occ.budget_id);
        if (!b) {
          res.status(400).json({ error: "Invalid budget_occurrence_id" });
          return;
        }
      }

      const row = await tx.create({
        project_id: projectId,
        created_by_user_id: req.userId,
        user_id: req.userId,
        type: body.type,
        name: body.name,
        amount: body.amount,
        line_status: body.line_status ?? "pending",
        payment_method: body.payment_method ?? "cash",
        occurred_at: body.occurred_at,
        category_id: body.category_id ?? null,
        note: body.note ?? null,
        budget_occurrence_id: body.budget_occurrence_id ?? null,
        bank_account_id: body.bank_account_id ?? null,
        card_id: body.card_id ?? null,
        upi_profile_id: body.upi_profile_id ?? null,
      });
      res.status(201).json(row);
    },
  };
}
