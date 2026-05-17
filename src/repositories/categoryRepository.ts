import { prisma } from "../lib/prisma.js";
import { toCategoryRow } from "../lib/prismaMappers.js";
import type { Database } from "../types/database.js";
import type { CategoryKind } from "@prisma/client";
import { seedDefaultCategories, seedDefaultGoals } from "../services/projectBootstrapService.js";

export class CategoryRepository {
  /** Idempotent: canonical category list + default goals for migrated/legacy projects. */
  async ensureCanonicalSeed(projectId: string, creatorUserId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await seedDefaultCategories(tx, projectId, creatorUserId);
      await seedDefaultGoals(tx, projectId, creatorUserId);
    });
  }

  async list(projectId: string): Promise<Database["public"]["Tables"]["category"]["Row"][]> {
    const rows = await prisma.category.findMany({
      where: { project_id: projectId },
      orderBy: { name: "asc" },
    });
    return rows.map(toCategoryRow);
  }

  async create(
    projectId: string,
    actingUserId: string,
    input: { name: string; icon: string; kind: CategoryKind }
  ) {
    const row = await prisma.category.create({
      data: {
        project_id: projectId,
        name: input.name,
        icon: input.icon,
        kind: input.kind,
        created_by_user_id: actingUserId,
      },
    });
    return toCategoryRow(row);
  }

  async getById(projectId: string, id: string) {
    const row = await prisma.category.findFirst({
      where: { project_id: projectId, id },
    });
    return row ? toCategoryRow(row) : null;
  }
}
