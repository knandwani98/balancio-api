import type { NextFunction, Request, Response } from "express";
import type { AuthedRequest } from "./clerkAuth.js";
import type { ClerkUserSyncService } from "../services/clerkUserSyncService.js";

export function ensureUserMiddleware(sync: ClerkUserSyncService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await sync.ensureUserExists((req as AuthedRequest).userId);
      next();
    } catch (err) {
      console.error("ensureUser:", err);
      res.status(503).json({ error: "Could not load user profile" });
    }
  };
}
