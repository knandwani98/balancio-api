import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { AnalyticsService } from "../services/analyticsService.js";
import { summaryQuerySchema } from "../models/schemas.js";

export function summaryController(analytics: AnalyticsService) {
  return {
    get: async (req: AuthedRequest, res: Response) => {
      const parsed = summaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const { year, month } = parsed.data;
      const dash = await analytics.monthlyDashboard(req.userId, year, month - 1);
      res.json(dash);
    },
  };
}
