import { prisma } from "../lib/prisma.js";
import type { ClerkUserUpsertInput } from "../lib/clerkUserProfile.js";

export class UserRepository {
  async upsertFromClerk(data: ClerkUserUpsertInput) {
    return prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {
        email: data.email,
        email_verified: data.email_verified,
        phone: data.phone,
        phone_verified: data.phone_verified,
        first_name: data.first_name,
        last_name: data.last_name,
        username: data.username,
        avatar_url: data.avatar_url,
        login_type: data.login_type,
      },
    });
  }

  async deleteById(id: string) {
    await prisma.user.deleteMany({ where: { id } });
  }

  async exists(id: string): Promise<boolean> {
    const n = await prisma.user.count({ where: { id } });
    return n > 0;
  }
}
