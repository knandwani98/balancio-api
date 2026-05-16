import { prisma } from "../lib/prisma.js";
import {
  categoriesForNestedProjectCreate,
  goalsForNestedProjectCreate,
} from "../services/projectBootstrapService.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class ProjectRepository {
  async listForUser(userId: string) {
    return prisma.project.findMany({
      where: {
        is_archive: false,
        members: { some: { user_id: userId } },
      },
      orderBy: { updated_at: "desc" },
      include: {
        members: { where: { user_id: userId }, select: { role: true } },
      },
    });
  }

  async getById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
    });
  }

  async createWithBootstrap(
    userId: string,
    input: { name: string; description?: string | null; icon_url?: string | null }
  ) {
    const goalRows = goalsForNestedProjectCreate(userId);
    return prisma.project.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        icon_url: input.icon_url ?? null,
        created_by_user_id: userId,
        members: {
          create: { user_id: userId, role: "admin" },
        },
        categories: {
          createMany: { data: categoriesForNestedProjectCreate(userId) },
        },
        ...(goalRows.length > 0
          ? { goals: { createMany: { data: goalRows } } }
          : {}),
      },
    });
  }

  async updateProject(
    projectId: string,
    patch: { name?: string; description?: string | null; icon_url?: string | null; is_archive?: boolean }
  ) {
    return prisma.project.update({
      where: { id: projectId },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && { description: patch.description }),
        ...(patch.icon_url !== undefined && { icon_url: patch.icon_url }),
        ...(patch.is_archive !== undefined && { is_archive: patch.is_archive }),
      },
    });
  }

  async deleteProject(projectId: string) {
    await prisma.project.delete({ where: { id: projectId } });
  }

  async createInvitation(projectId: string, invitedByUserId: string, email: string) {
    return prisma.projectInvitation.create({
      data: {
        project_id: projectId,
        email_normalized: normalizeEmail(email),
        invited_by_user_id: invitedByUserId,
        status: "SENT",
      },
    });
  }

  async listInvitations(projectId: string) {
    return prisma.projectInvitation.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
    });
  }

  async revokeInvitation(invitationId: string, projectId: string) {
    return prisma.projectInvitation.updateMany({
      where: { id: invitationId, project_id: projectId, status: "SENT" },
      data: { status: "REVOKED", responded_at: new Date() },
    });
  }

  async findPendingInvitesForEmail(emailNormalized: string) {
    return prisma.projectInvitation.findMany({
      where: { email_normalized: emailNormalized, status: "SENT" },
      include: { project: true },
    });
  }

  async acceptInvitation(invitationId: string, userId: string, userEmailNormalized: string) {
    const inv = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, status: "SENT" },
    });
    if (!inv) return { ok: false as const, reason: "not_found" as const };
    if (inv.email_normalized !== userEmailNormalized) {
      return { ok: false as const, reason: "email_mismatch" as const };
    }
    await prisma.$transaction(async (tx) => {
      await tx.projectInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED", responded_at: new Date() },
      });
      await tx.projectMember.upsert({
        where: { project_id_user_id: { project_id: inv.project_id, user_id: userId } },
        create: { project_id: inv.project_id, user_id: userId, role: "member" },
        update: {},
      });
    });
    return { ok: true as const };
  }

  async denyInvitation(invitationId: string, userEmailNormalized: string) {
    const inv = await prisma.projectInvitation.findFirst({
      where: { id: invitationId, status: "SENT" },
    });
    if (!inv) return { ok: false as const, reason: "not_found" as const };
    if (inv.email_normalized !== userEmailNormalized) {
      return { ok: false as const, reason: "email_mismatch" as const };
    }
    await prisma.projectInvitation.update({
      where: { id: invitationId },
      data: { status: "DENIED", responded_at: new Date() },
    });
    return { ok: true as const };
  }
}
