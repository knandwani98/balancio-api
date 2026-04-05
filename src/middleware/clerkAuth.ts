import { verifyToken } from "@clerk/backend";
import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env.js";

export type AuthedRequest = Request & { userId: string };

export function clerkAuthMiddleware(env: Env) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({ error: "Missing token" });
      return;
    }
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      const userId = payload.sub;
      if (!userId) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      (req as AuthedRequest).userId = userId;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
