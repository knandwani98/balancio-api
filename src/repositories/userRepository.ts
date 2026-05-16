import { prisma } from "../lib/prisma.js";
import type { ClerkUserUpsertInput } from "../lib/clerkUserProfile.js";

export class UserRepository {
  async upsertFromClerk(data: ClerkUserUpsertInput) {
    const phoneFromClerk = data.phone?.trim() ?? "";
    const hasClerkPhone = phoneFromClerk.length > 0;
    return prisma.user.upsert({
      where: { id: data.id },
      create: data,
      update: {
        email: data.email,
        email_verified: data.email_verified,
        ...(hasClerkPhone ? { phone: data.phone } : {}),
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

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async updateMe(
    id: string,
    data: {
      first_name: string;
      last_name: string;
      phone: string;
      username?: string | null;
      avatar_url?: string | null;
    }
  ) {
    return prisma.user.update({
      where: { id },
      data: {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        ...(data.username !== undefined ? { username: data.username } : {}),
        ...(data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {}),
      },
    });
  }
}
