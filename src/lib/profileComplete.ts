import type { User } from "@prisma/client";

/** Gate project create / invite until onboarding profile is saved (names, phone, avatar). */
export function isProfileComplete(user: Pick<User, "first_name" | "last_name" | "phone" | "avatar_url">): boolean {
  const fn = user.first_name?.trim();
  const ln = user.last_name?.trim();
  const av = user.avatar_url?.trim();
  const ph = user.phone?.trim();
  return Boolean(fn && ln && ph && av);
}
