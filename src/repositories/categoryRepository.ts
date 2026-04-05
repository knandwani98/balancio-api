import { prisma } from "../lib/prisma.js";
import { toCategoryRow } from "../lib/prismaMappers.js";
import type { Database } from "../types/database.js";

const UNASSIGNED_TITLE = "unassigned";

export class CategoryRepository {
  async ensureUnassigned(userId: string) {
    return prisma.category.upsert({
      where: {
        user_id_title: { user_id: userId, title: UNASSIGNED_TITLE },
      },
      create: { user_id: userId, title: UNASSIGNED_TITLE },
      update: {},
      select: { id: true },
    });
  }

  async list(userId: string): Promise<Database["public"]["Tables"]["category"]["Row"][]> {
    await this.ensureUnassigned(userId);
    const rows = await prisma.category.findMany({
      where: { user_id: userId },
      orderBy: { title: "asc" },
    });
    return rows.map(toCategoryRow);
  }

  async create(userId: string, input: { title: string; image_url?: string | null }) {
    await this.ensureUnassigned(userId);
    const row = await prisma.category.create({
      data: {
        user_id: userId,
        title: input.title,
        image_url: input.image_url ?? null,
      },
    });
    return toCategoryRow(row);
  }

  async getById(userId: string, id: string) {
    const row = await prisma.category.findFirst({
      where: { user_id: userId, id },
    });
    return row ? toCategoryRow(row) : null;
  }
}
