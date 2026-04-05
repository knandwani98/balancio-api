import type { Request as ExpressRequest, Response } from "express";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Env } from "../config/env.js";
import { clerkUserJsonToUpsert } from "../lib/clerkUserProfile.js";
import type { UserRepository } from "../repositories/userRepository.js";

function toWebRequest(req: ExpressRequest): globalThis.Request {
  const host = req.get("host") ?? "localhost";
  const proto = req.protocol || "http";
  const url = `${proto}://${host}${req.originalUrl}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(",") : v);
  }
  const body = req.body;
  const bodyInit = Buffer.isBuffer(body)
    ? new Uint8Array(body)
    : typeof body === "string"
      ? body
      : JSON.stringify(body ?? {});
  return new Request(url, { method: req.method, headers, body: bodyInit });
}

export function clerkWebhookController(env: Env, users: UserRepository) {
  return async (req: ExpressRequest, res: Response) => {
    try {
      const evt = await verifyWebhook(toWebRequest(req), {
        signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
      });

      if (evt.type === "user.created" || evt.type === "user.updated") {
        await users.upsertFromClerk(clerkUserJsonToUpsert(evt.data));
      } else if (evt.type === "user.deleted") {
        const id = evt.data.id;
        if (id) await users.deleteById(id);
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Clerk webhook:", err);
      res.status(400).json({ error: "Webhook verification or handling failed" });
    }
  };
}
