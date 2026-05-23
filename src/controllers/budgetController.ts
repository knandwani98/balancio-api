import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { computeOccurrences, mergeOccurrences } from "../services/budgetOccurrenceService.js";
import { backfillBudgetOccurrencesOnCreate } from "../services/budgetMaterializationService.js";
import type { TransactionType } from "../types/database.js";
import { createBudgetSchema, patchOccurrenceSchema, updateBudgetSchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

export function budgetController(
  budgets: BudgetRepository,
  transactions: TransactionRepository,
  categories: CategoryRepository,
  projects: ProjectRepository
) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const rows = await budgets.list(projectId);
      res.json(rows);
    },
    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const row = await budgets.getById(projectId, String(req.params.budgetId));
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    },
    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const cat = await categories.getById(projectId, parsed.data.category_id);
      if (!cat) {
        res.status(400).json({ error: "Invalid category_id" });
        return;
      }
      const pm = parsed.data.payment_method ?? "cash";
      const row = await budgets.create(projectId, req.userId, {
        category_id: parsed.data.category_id,
        title: parsed.data.title,
        default_planned_amount: parsed.data.default_planned_amount,
        start_date: parsed.data.start_date,
        recurrence_end_date: parsed.data.recurrence_end_date ?? null,
        due_day_of_occurence: parsed.data.due_day_of_occurence,
        recurrence: parsed.data.recurrence,
        payment_method: pm,
        bank_account_id: pm === "bank" ? (parsed.data.bank_account_id ?? null) : null,
        card_id: pm === "cards" ? (parsed.data.card_id ?? null) : null,
      });
      const txType: TransactionType = cat.kind === "income" ? "income" : "expense";
      await backfillBudgetOccurrencesOnCreate(row, req.userId, txType);
      res.status(201).json(row);
    },
    update: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const budgetId = String(req.params.budgetId);
      const parsed = updateBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      if (parsed.data.category_id) {
        const cat = await categories.getById(projectId, parsed.data.category_id);
        if (!cat) {
          res.status(400).json({ error: "Invalid category_id" });
          return;
        }
      }
      const row = await budgets.update(projectId, budgetId, parsed.data);
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    },
    remove: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const budgetId = String(req.params.budgetId);
      const existing = await budgets.getById(projectId, budgetId);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await budgets.delete(projectId, budgetId);
      res.status(204).send();
    },
    listOccurrences: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const budget = await budgets.getById(projectId, String(req.params.budgetId));
      if (!budget) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      if (!from || !to) {
        res.status(400).json({ error: "Query params from and to (YYYY-MM-DD) required" });
        return;
      }
      const virtual = computeOccurrences(budget, from, to);
      const dbRows = await transactions.listBudgetPeriodsInRange(budget.id, from, to);
      const merged = mergeOccurrences(virtual, dbRows);
      res.json(merged);
    },
    patchOccurrence: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const budget = await budgets.getById(projectId, String(req.params.budgetId));
      if (!budget) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const cat = await categories.getById(projectId, budget.category_id);
      const txType: TransactionType = cat?.kind === "income" ? "income" : "expense";

      const periodStart = String(req.params.periodStart);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
        res.status(400).json({ error: "Invalid periodStart" });
        return;
      }
      const parsed = patchOccurrenceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const virtual = computeOccurrences(budget, periodStart, periodStart);
      const dbRows = await transactions.listBudgetPeriodsInRange(budget.id, periodStart, periodStart);
      const merged = mergeOccurrences(virtual, dbRows);
      const hit = merged.find((m) => m.period_start === periodStart);
      const dueDate = hit?.due_date ?? periodStart;

      await transactions.upsertBudgetPeriod(budget, projectId, req.userId, txType, {
        period_start: periodStart,
        due_date: dueDate,
        planned_amount: parsed.data.planned_amount,
        actual_amount: parsed.data.actual_amount,
        note: parsed.data.note,
        line_status:
          parsed.data.actual_amount != null ? "cleared" : undefined,
      });

      const refreshed = mergeOccurrences(
        virtual,
        await transactions.listBudgetPeriodsInRange(budget.id, periodStart, periodStart)
      );
      const row = refreshed.find((m) => m.period_start === periodStart);
      res.json(row ?? hit);
    },
  };
}
