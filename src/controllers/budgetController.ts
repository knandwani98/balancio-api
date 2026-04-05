import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { BudgetOccurrenceRepository } from "../repositories/budgetOccurrenceRepository.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import { computeOccurrences, mergeOccurrences } from "../services/budgetOccurrenceService.js";
import { createBudgetSchema, patchOccurrenceSchema, updateBudgetSchema } from "../models/schemas.js";

export function budgetController(
  budgets: BudgetRepository,
  occurrences: BudgetOccurrenceRepository,
  categories: CategoryRepository
) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const rows = await budgets.list(req.userId);
      res.json(rows);
    },
    get: async (req: AuthedRequest, res: Response) => {
      const row = await budgets.getById(req.userId, String(req.params.id));
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    },
    create: async (req: AuthedRequest, res: Response) => {
      const parsed = createBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const cat = await categories.getById(req.userId, parsed.data.category_id);
      if (!cat) {
        res.status(400).json({ error: "Invalid category_id" });
        return;
      }
      const row = await budgets.create(req.userId, {
        category_id: parsed.data.category_id,
        title: parsed.data.title,
        default_planned_amount_paise: parsed.data.default_planned_amount_paise,
        start_date: parsed.data.start_date,
        recurrence_end_date: parsed.data.recurrence_end_date ?? null,
        due_day_of_month: parsed.data.due_day_of_month,
        recurrence: parsed.data.recurrence,
      });
      res.status(201).json(row);
    },
    update: async (req: AuthedRequest, res: Response) => {
      const parsed = updateBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      if (parsed.data.category_id) {
        const cat = await categories.getById(req.userId, parsed.data.category_id);
        if (!cat) {
          res.status(400).json({ error: "Invalid category_id" });
          return;
        }
      }
      const row = await budgets.update(req.userId, String(req.params.id), parsed.data);
      if (!row) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(row);
    },
    remove: async (req: AuthedRequest, res: Response) => {
      const existing = await budgets.getById(req.userId, String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await budgets.delete(req.userId, String(req.params.id));
      res.status(204).send();
    },
    listOccurrences: async (req: AuthedRequest, res: Response) => {
      const budget = await budgets.getById(req.userId, String(req.params.id));
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
      const dbRows = await occurrences.listForBudgetInRange(budget.id, from, to);
      const merged = mergeOccurrences(virtual, dbRows);
      res.json(merged);
    },
    patchOccurrence: async (req: AuthedRequest, res: Response) => {
      const budget = await budgets.getById(req.userId, String(req.params.id));
      if (!budget) {
        res.status(404).json({ error: "Not found" });
        return;
      }
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
      const row = await occurrences.upsert(budget.id, {
        period_start: periodStart,
        planned_amount_paise: parsed.data.planned_amount_paise,
        actual_amount_paise: parsed.data.actual_amount_paise,
        paid_at: parsed.data.paid_at,
        note: parsed.data.note,
      });
      res.json(row);
    },
  };
}
