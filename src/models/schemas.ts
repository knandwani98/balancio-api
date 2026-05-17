import { z } from "zod";

/** Non-negative monetary amount (fractional values allowed). */
export const amountNonNegative = z
  .number()
  .nonnegative()
  .finite()
  .max(1e15, "amount too large");

export const createCategorySchema = z.object({
  name: z.string().min(1),
  icon: z.string().min(1),
  kind: z.enum(["expense", "income", "neutral"]),
});

export const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]).default("expense"),
  name: z.string().min(1),
  amount: amountNonNegative,
  line_status: z.enum(["pending", "cleared", "failed"]).optional(),
  payment_method: z.enum(["cash", "bank", "cards", "upi", "stocks", "wallet"]).optional(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().optional().nullable(),
  note: z.string().optional().nullable(),
  budget_occurrence_id: z.string().uuid().optional().nullable(),
  bank_account_id: z.string().uuid().optional().nullable(),
  card_id: z.string().uuid().optional().nullable(),
  upi_profile_id: z.string().uuid().optional().nullable(),
});

export const createBudgetSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(1),
  default_planned_amount: amountNonNegative,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_day_of_month: z.number().int().min(1).max(31),
  recurrence: z
    .enum(["monthly", "yearly", "quarterly", "weekly", "daily", "one_time"])
    .default("monthly"),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export const patchOccurrenceSchema = z.object({
  planned_amount: amountNonNegative.optional().nullable(),
  actual_amount: amountNonNegative.optional().nullable(),
  paid_at: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const summaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
  is_archive: z.boolean().optional(),
});

export const inviteEmailSchema = z.object({
  email: z.string().email(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1),
  amount: amountNonNegative,
  frequency: z.enum(["monthly", "yearly", "quarterly", "weekly", "daily", "one_time"]),
  tenure_mode: z.enum(["infinite", "fixed_days", "aim"]),
  fixed_days: z.number().int().positive().optional().nullable(),
  aim_amount: amountNonNegative.optional().nullable(),
  source: z.enum(["cash", "bank", "cards", "upi", "stocks", "wallet"]),
  interest_rate_pa: z.number().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  linked_bank_account_id: z.string().uuid().optional().nullable(),
});

export const createBankAccountSchema = z.object({
  bank_id: z.string().min(1).optional().nullable(),
  bank_name: z.string().min(1),
  nickname: z.string().min(1),
  account_mask: z.string().max(32).optional().nullable(),
  icon_url: z.string().url().optional().nullable(),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

/**
 * PCI: never persist full card numbers. Optional `number_for_brand_detection` is used in-memory only
 * with getCardType(); only last4 + brand are stored.
 */
export const createCardSchema = z.object({
  card_type: z.enum(["credit", "debit"]),
  last4: z.string().regex(/^\d{4}$/),
  brand: z.string().min(1).optional(),
  nickname: z.string().optional().nullable(),
  number_for_brand_detection: z.string().min(12).max(22).optional(),
});

export const updateCardSchema = z.object({
  nickname: z.string().optional().nullable(),
});

export const createUpiProfileSchema = z.object({
  upi_id: z.string().min(3),
  nickname: z.string().min(1),
});

export const updateUpiProfileSchema = z.object({
  upi_id: z.string().min(3).optional(),
  nickname: z.string().min(1).optional(),
});

/** Clerk/CDN profile images must parse as URLs; strict `z.string().url()` can reject valid Clerk URLs. */
export const profileImageUrlSchema = z
  .string()
  .min(8)
  .max(2048)
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Invalid profile image URL" }
  );

/** Onboarding / profile: persisted on `user` (phone is not verified via SMS). */
export const patchMyProfileSchema = z.object({
  first_name: z.string().min(1).max(128),
  last_name: z.string().min(1).max(128),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  username: z.string().max(64).nullable().optional(),
  avatar_url: profileImageUrlSchema.optional().nullable(),
});
