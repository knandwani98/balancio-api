import type { User, UserJSON } from "@clerk/backend";
import type { AuthLoginType } from "@prisma/client";

export type ClerkUserUpsertInput = {
  id: string;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  login_type: AuthLoginType;
};

function isVerified(status: string | undefined): boolean {
  return status === "verified";
}

function loginTypeFromOauthProvider(provider: string | undefined): AuthLoginType | null {
  if (provider === "oauth_google") return "google";
  if (provider === "oauth_apple") return "apple";
  if (provider === "oauth_github") return "github";
  if (provider === "oauth_microsoft") return "microsoft";
  return null;
}

function loginTypeFromUserJson(data: UserJSON): AuthLoginType {
  const fromOauth = loginTypeFromOauthProvider(data.external_accounts?.[0]?.provider);
  if (fromOauth) return fromOauth;
  if (data.saml_accounts?.length) return "other";
  if (data.password_enabled) return "email";
  if (data.email_addresses?.length) return "email";
  return "other";
}

function primaryEmail(data: UserJSON): { address: string | null; verified: boolean } {
  const primaryId = data.primary_email_address_id;
  const list = data.email_addresses ?? [];
  const primary = primaryId ? list.find((e) => e.id === primaryId) : list[0];
  if (!primary) return { address: null, verified: false };
  return {
    address: primary.email_address,
    verified: isVerified(primary.verification?.status),
  };
}

function primaryPhoneNumber(data: UserJSON): string | null {
  const primaryId = data.primary_phone_number_id;
  const list = data.phone_numbers ?? [];
  const primary = primaryId ? list.find((p) => p.id === primaryId) : list[0];
  if (!primary) return null;
  return primary.phone_number;
}

export function clerkUserJsonToUpsert(data: UserJSON): ClerkUserUpsertInput {
  const email = primaryEmail(data);
  const avatar = data.image_url?.trim();
  return {
    id: data.id,
    email: email.address,
    email_verified: email.verified,
    phone: primaryPhoneNumber(data),
    first_name: data.first_name,
    last_name: data.last_name,
    username: data.username,
    avatar_url: avatar && avatar.length > 0 ? avatar : null,
    login_type: loginTypeFromUserJson(data),
  };
}

function loginTypeFromSdkUser(user: User): AuthLoginType {
  const fromOauth = loginTypeFromOauthProvider(user.externalAccounts[0]?.provider);
  if (fromOauth) return fromOauth;
  if (user.samlAccounts.length) return "other";
  if (user.passwordEnabled) return "email";
  if (user.emailAddresses.length) return "email";
  return "other";
}

export function clerkSdkUserToUpsert(user: User): ClerkUserUpsertInput {
  const raw = user.raw;
  if (raw) return clerkUserJsonToUpsert(raw);
  const email = user.primaryEmailAddress;
  const phone = user.primaryPhoneNumber;
  const avatar = user.imageUrl?.trim();
  return {
    id: user.id,
    email: email?.emailAddress ?? null,
    email_verified: isVerified(email?.verification?.status),
    phone: phone?.phoneNumber ?? null,
    first_name: user.firstName,
    last_name: user.lastName,
    username: user.username,
    avatar_url: avatar && avatar.length > 0 ? avatar : null,
    login_type: loginTypeFromSdkUser(user),
  };
}
