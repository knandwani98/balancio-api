import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import { patchMyProfileSchema } from "../models/schemas.js";
import type { UserRepository } from "../repositories/userRepository.js";
import { isProfileComplete } from "../lib/profileComplete.js";

export function userProfileController(users: UserRepository) {
  return {
    getMe: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        username: u.username,
        avatar_url: u.avatar_url,
      });
    },

    patchMe: async (req: AuthedRequest, res: Response) => {
      const parsed = patchMyProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const u = await users.findById(req.userId);
      if (!u) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const row = await users.updateMe(req.userId, parsed.data);
      res.json({
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone,
        username: row.username,
        avatar_url: row.avatar_url,
      });
    },

    profileComplete: async (req: AuthedRequest, res: Response) => {
      const u = await users.findById(req.userId);
      if (!u) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ complete: isProfileComplete(u) });
    },
  };
}
