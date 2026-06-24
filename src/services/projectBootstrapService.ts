import type { Prisma } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../data/defaultCategories.js";

/** Rows for `project.create({ data: { categories: { createMany: { data } } } })` (no `project_id`; Prisma sets it). */
export function categoriesForNestedProjectCreate(
  createdByUserId: string
): Prisma.CategoryCreateManyProjectInput[] {
  return DEFAULT_CATEGORIES.map((c) => ({
    name: c.name,
    icon: c.icon,
    kind: c.type,
    created_by_user_id: createdByUserId,
  }));
}

export async function seedDefaultCategories(
  tx: Prisma.TransactionClient,
  projectId: string,
  creatorUserId: string
): Promise<void> {
  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      project_id: projectId,
      name: c.name,
      icon: c.icon,
      kind: c.type,
      created_by_user_id: creatorUserId,
    })),
    skipDuplicates: true,
  });
}
