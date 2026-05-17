import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { createCategorySchema } from "../models/schemas.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

export function categoryController(categories: CategoryRepository, projects: ProjectRepository) {
  return {
    list: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const p = await projects.getById(projectId);
      if (!p) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      await categories.ensureCanonicalSeed(projectId, p.created_by_user_id);
      const rows = await categories.list(projectId);
      res.json(rows);
    },
    create: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const p = await projects.getById(projectId);
      if (!p) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const parsed = createCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      try {
        const row = await categories.create(projectId, req.userId, parsed.data);
        res.status(201).json(row);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed";
        if (msg.includes("duplicate") || msg.includes("unique")) {
          res.status(409).json({ error: "Category already exists for this project/type" });
          return;
        }
        throw e;
      }
    },
  };
}
