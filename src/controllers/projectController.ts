import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import type { UserRepository } from "../repositories/userRepository.js";
import {
  createProjectSchema,
  inviteEmailSchema,
  updateProjectSchema,
} from "../models/schemas.js";
import { assertProjectAdmin, assertProjectMember } from "../lib/projectAuthz.js";
import { isProfileComplete } from "../lib/profileComplete.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function projectController(projects: ProjectRepository, users: UserRepository) {
  return {
    listMine: async (req: AuthedRequest, res: Response) => {
      const rows = await projects.listForUser(req.userId);
      res.json(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          icon_url: p.icon_url,
          is_archive: p.is_archive,
          created_by_user_id: p.created_by_user_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
          my_role: p.members[0]?.role ?? null,
        }))
      );
    },

    create: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u || !isProfileComplete(u)) {
        res.status(400).json({
          error: "Profile incomplete",
          detail: "Require first name, last name, phone number, and avatar.",
        });
        return;
      }
      const parsed = createProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const project = await projects.createWithBootstrap(req.userId, parsed.data);
      res.status(201).json(project);
    },

    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const p = await projects.getById(projectId);
      if (!p) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(p);
    },

    update: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectAdmin(req.userId, projectId);
      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const p = await projects.updateProject(projectId, parsed.data);
      res.json(p);
    },

    remove: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectAdmin(req.userId, projectId);
      await projects.deleteProject(projectId);
      res.status(204).send();
    },

    invite: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectAdmin(req.userId, projectId);
      const u = await users.findById(req.userId);
      if (!u || !isProfileComplete(u)) {
        res.status(400).json({ error: "Profile incomplete" });
        return;
      }
      const parsed = inviteEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const inv = await projects.createInvitation(projectId, req.userId, parsed.data.email);
      res.status(201).json(inv);
    },

    listInvitations: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectAdmin(req.userId, projectId);
      const rows = await projects.listInvitations(projectId);
      res.json(rows);
    },

    revokeInvitation: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      const invitationId = String(req.params.invitationId);
      await assertProjectAdmin(req.userId, projectId);
      const n = await projects.revokeInvitation(invitationId, projectId);
      if (n.count === 0) {
        res.status(404).json({ error: "Invitation not found or not revocable" });
        return;
      }
      res.json({ ok: true });
    },

    pendingInvitesForMe: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u?.email) {
        res.status(400).json({ error: "User has no email on file" });
        return;
      }
      const rows = await projects.findPendingInvitesForEmail(normalizeEmail(u.email));
      res.json(rows);
    },

    acceptInvite: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u?.email || !u.email_verified) {
        res.status(400).json({ error: "Verified primary email required" });
        return;
      }
      const invitationId = String(req.params.invitationId);
      const result = await projects.acceptInvitation(
        invitationId,
        req.userId,
        normalizeEmail(u.email)
      );
      if (!result.ok) {
        if (result.reason === "email_mismatch") {
          res.status(403).json({ error: "Invitation email does not match your account" });
          return;
        }
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json({ ok: true });
    },

    denyInvite: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u?.email || !u.email_verified) {
        res.status(400).json({ error: "Verified primary email required" });
        return;
      }
      const invitationId = String(req.params.invitationId);
      const result = await projects.denyInvitation(invitationId, normalizeEmail(u.email));
      if (!result.ok) {
        if (result.reason === "email_mismatch") {
          res.status(403).json({ error: "Invitation email does not match your account" });
          return;
        }
        res.status(404).json({ error: "Invitation not found" });
        return;
      }
      res.json({ ok: true });
    },
  };
}
