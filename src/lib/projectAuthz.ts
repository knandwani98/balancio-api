import type { ProjectRole } from "@prisma/client";
import { prisma } from "./prisma.js";

export type ProjectAccess = {
  role: ProjectRole;
};

export async function getProjectMembership(
  userId: string,
  projectId: string
): Promise<ProjectAccess | null> {
  const m = await prisma.projectMember.findFirst({
    where: { project_id: projectId, user_id: userId },
    select: { role: true },
  });
  return m ? { role: m.role } : null;
}

export async function assertProjectMember(userId: string, projectId: string): Promise<ProjectAccess> {
  const m = await getProjectMembership(userId, projectId);
  if (!m) {
    const err = new Error("Forbidden: not a project member");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return m;
}

export async function assertProjectAdmin(userId: string, projectId: string): Promise<ProjectAccess> {
  const m = await assertProjectMember(userId, projectId);
  if (m.role !== "admin") {
    const err = new Error("Forbidden: project admin only");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return m;
}
