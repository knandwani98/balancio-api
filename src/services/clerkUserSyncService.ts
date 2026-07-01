import { createClerkClient } from "@clerk/backend";
import type { Env } from "../config/env.js";
import { clerkSdkUserToUpsert } from "../lib/clerkUserProfile.js";
import type { UserRepository } from "../repositories/userRepository.js";

export class ClerkUserSyncService {
  private readonly client: ReturnType<typeof createClerkClient>;
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly env: Env,
    private readonly users: UserRepository
  ) {
    this.client = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  }

  /** Ensures a row exists for this Clerk user (first API call before webhooks). */
  async ensureUserExists(clerkUserId: string): Promise<void> {
    if (await this.users.exists(clerkUserId)) return;

    const existing = this.inflight.get(clerkUserId);
    if (existing) {
      await existing;
      return;
    }

    const work = (async () => {
      if (await this.users.exists(clerkUserId)) return;
      const user = await this.client.users.getUser(clerkUserId);
      await this.users.upsertFromClerk(clerkSdkUserToUpsert(user));
    })();

    this.inflight.set(clerkUserId, work);
    try {
      await work;
    } finally {
      this.inflight.delete(clerkUserId);
    }
  }
}
