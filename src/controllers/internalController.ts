import type { Request, Response } from "express";
import type { Env } from "../config/env.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import { occurrencesDueOn } from "../services/budgetOccurrenceService.js";
import { toISODate } from "../utils/dates.js";
import { prisma } from "../lib/prisma.js";
import { tickOccurrenceScheduleStatuses } from "../services/recurringTickService.js";

function authorizeCron(req: Request, env: Env): boolean {
  const secret = env.INTERNAL_CRON_SECRET;
  if (!secret) return true;
  return (
    req.headers["x-cron-secret"] === secret ||
    (typeof req.query.secret === "string" && req.query.secret === secret)
  );
}

export function internalController(env: Env, budgets: BudgetRepository) {
  return {
    dueSoon: async (req: Request, res: Response) => {
      if (!authorizeCron(req, env)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const target = toISODate(tomorrow);

      const { user_id } = req.query;
      if (typeof user_id !== "string" || !user_id) {
        res.status(400).json({ error: "Query user_id required for MVP cron (per-user scan)" });
        return;
      }

      const projectRows = await prisma.project.findMany({
        where: { members: { some: { user_id } } },
        select: { id: true },
      });

      const hits: {
        project_id: string;
        budget_id: string;
        title: string;
        due_date: string;
        period_start: string;
      }[] = [];

      for (const { id: projectId } of projectRows) {
        const list = await budgets.list(projectId);
        for (const b of list) {
          const due = occurrencesDueOn(b, target);
          for (const o of due) {
            hits.push({
              project_id: projectId,
              budget_id: b.id,
              title: b.title,
              due_date: o.due_date,
              period_start: o.period_start,
            });
          }
        }
      }

      res.json({ target_date: target, count: hits.length, items: hits });
    },

    recurringTick: async (req: Request, res: Response) => {
      if (!authorizeCron(req, env)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const todayIso =
        typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
          ? req.query.date
          : toISODate(new Date());
      const counts = await tickOccurrenceScheduleStatuses(todayIso);
      res.json({ date: todayIso, ...counts });
    },
  };
}
