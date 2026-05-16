import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { AnalyticsService } from "../services/analyticsService.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { summaryQuerySchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

export function summaryController(analytics: AnalyticsService, projects: ProjectRepository) {
  return {
    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = summaryQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const { year, month } = parsed.data;
      const p = await projects.getById(projectId);
      if (!p) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const dash = await analytics.monthlyDashboard(projectId, p.created_by_user_id, year, month - 1);
      res.json(dash);
    },
  };
}
