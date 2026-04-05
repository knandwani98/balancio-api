import type { Request, Response } from "express";
import type { Env } from "../config/env.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import { occurrencesDueOn } from "../services/budgetOccurrenceService.js";
import { toISODate } from "../utils/dates.js";

export function internalController(env: Env, budgets: BudgetRepository) {
  return {
    dueSoon: async (req: Request, res: Response) => {
      const secret = env.INTERNAL_CRON_SECRET;
      if (secret) {
        const provided =
          req.headers["x-cron-secret"] === secret ||
          (typeof req.query.secret === "string" && req.query.secret === secret);
        if (!provided) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      }

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const target = toISODate(tomorrow);

      const { user_id } = req.query;
      if (typeof user_id !== "string" || !user_id) {
        res.status(400).json({ error: "Query user_id required for MVP cron (per-user scan)" });
        return;
      }

      const list = await budgets.list(user_id);
      const hits: { budget_id: string; title: string; due_date: string; period_start: string }[] =
        [];

      for (const b of list) {
        const due = occurrencesDueOn(b, target);
        for (const o of due) {
          hits.push({
            budget_id: b.id,
            title: b.title,
            due_date: o.due_date,
            period_start: o.period_start,
          });
        }
      }

      res.json({ target_date: target, count: hits.length, items: hits });
    },
  };
}
