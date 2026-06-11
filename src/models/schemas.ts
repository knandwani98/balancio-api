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

export const importStatementLineSchema = z.object({
  statement_order: z.number().int().nonnegative().optional(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
  reference_no: z.string().max(500).nullable().optional(),
  type: z.enum(["income", "expense"]),
  amount: amountNonNegative.refine((n) => n > 0, "amount must be greater than zero"),
  note: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
});

export const confirmImportStatementSchema = z.object({
  bank_account_id: z.string().uuid(),
  lines: z.array(importStatementLineSchema).min(1, "Select at least one transaction"),
  opening_balance: amountNonNegative.nullable().optional(),
  closing_balance: amountNonNegative.nullable().optional(),
});

export const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]).default("expense"),
  name: z.string().min(1),
  amount: amountNonNegative,
  line_status: z.enum(["pending", "cleared", "failed"]).optional(),
  payment_method: z.enum(["cash", "bank", "cards", "stocks", "wallet"]).optional(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  reference_details: z.string().max(500).optional().nullable(),
  budget_id: z.string().uuid().optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bank_account_id: z.string().uuid().optional().nullable(),
  card_id: z.string().uuid().optional().nullable(),
  wallet_id: z.string().uuid().optional().nullable(),
});

/** Same fields as create, excluding links not editable from the transactions UI. */
export const updateTransactionSchema = createTransactionSchema.omit({
  budget_id: true,
  due_date: true,
  bank_account_id: true,
  card_id: true,
});

const budgetPaymentMethod = z.enum(["cash", "bank", "cards", "stocks", "wallet"]);

const budgetPaymentRefine = (
  data: {
    payment_method?: z.infer<typeof budgetPaymentMethod>;
    bank_account_id?: string | null;
    card_id?: string | null;
    wallet_id?: string | null;
  },
  ctx: z.RefinementCtx
) => {
  const pm = data.payment_method ?? "cash";
  if (pm === "bank" && !data.bank_account_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "bank_account_id required when payment_method is bank",
      path: ["bank_account_id"],
    });
  }
  if (pm === "cards" && !data.card_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "card_id required when payment_method is cards",
      path: ["card_id"],
    });
  }
  if (pm === "wallet" && !data.wallet_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "wallet_id required when payment_method is wallet",
      path: ["wallet_id"],
    });
  }
};

const createBudgetSchemaBase = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(1),
  default_planned_amount: amountNonNegative,
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_day_of_occurence: z.number().int().min(1).max(31),
  recurrence: z
    .enum(["monthly", "yearly", "quarterly", "half_yearly", "weekly", "daily", "one_time"])
    .default("monthly"),
  payment_method: budgetPaymentMethod.optional(),
  bank_account_id: z.string().uuid().optional().nullable(),
  card_id: z.string().uuid().optional().nullable(),
  wallet_id: z.string().uuid().optional().nullable(),
});

export const createBudgetSchema = createBudgetSchemaBase.superRefine(budgetPaymentRefine);

export const updateBudgetSchema = createBudgetSchemaBase.partial().superRefine(budgetPaymentRefine);

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

const budgetRecurrenceEnum = z.enum([
  "monthly",
  "yearly",
  "quarterly",
  "half_yearly",
  "weekly",
  "daily",
  "one_time",
]);

export const planFundInputSchema = z.object({
  name: z.string().min(1).max(120),
  input_mode: z.enum(["percentage", "amount"]),
  value: amountNonNegative.refine((n) => n > 0, "value must be greater than zero"),
});

export const createPlanPointBodySchema = z.object({
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_amount: amountNonNegative.refine((n) => n > 0, "period_amount must be greater than zero"),
  funds: z.array(planFundInputSchema).min(1, "At least one fund is required"),
});

export const createInvestmentPlanSchema = z.object({
  name: z.string().min(1).max(120),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  period_amount: amountNonNegative.refine((n) => n > 0, "period_amount must be greater than zero"),
  frequency: budgetRecurrenceEnum.default("monthly"),
  initial_point: z.object({
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    funds: z.array(planFundInputSchema).min(1, "At least one fund is required"),
  }),
});

export const updateInvestmentPlanSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  period_amount: amountNonNegative
    .refine((n) => n > 0, "period_amount must be greater than zero")
    .optional(),
  frequency: budgetRecurrenceEnum.optional(),
});

export const createPlanPointSchema = createPlanPointBodySchema;

export const updatePlanPointSchema = z.object({
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_amount: amountNonNegative
    .refine((n) => n > 0, "period_amount must be greater than zero")
    .optional(),
  funds: z.array(planFundInputSchema).min(1).optional(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1),
  amount: amountNonNegative,
  frequency: z.enum(["monthly", "yearly", "quarterly", "weekly", "daily", "one_time"]),
  tenure_mode: z.enum(["infinite", "fixed_days", "aim"]),
  fixed_days: z.number().int().positive().optional().nullable(),
  aim_amount: amountNonNegative.optional().nullable(),
  source: z.enum(["cash", "bank", "cards", "stocks", "wallet"]),
  interest_rate_pa: z.number().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  linked_bank_account_id: z.string().uuid().optional().nullable(),
});

const accountNumberDigits = z
  .number()
  .int()
  .min(1, "account_number must be at least 1")
  .max(9999, "account_number must be at most 4 digits");

export const createBankAccountSchema = z.object({
  bank_id: z.string().min(1).optional().nullable(),
  bank_name: z.string().min(1),
  nickname: z
    .string()
    .max(128)
    .optional()
    .nullable()
    .transform((s) => (s == null || s.trim() === "" ? null : s.trim())),
  account_number: accountNumberDigits,
  account_type: z.enum(["savings", "current"]),
  current_balance: amountNonNegative.optional(),
  icon_url: z.string().url().optional().nullable(),
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

/**
 * PCI: never persist full card numbers. Optional `number_for_brand_detection` is used in-memory only
 * with getCardType(); only last4 + brand are stored.
 */
export const createCardSchema = z.object({
  bank_id: z.string().min(1).optional().nullable(),
  bank_name: z.string().min(1),
  card_type: z.enum(["credit", "debit"]),
  brand: z.string().min(1).optional(),
  nickname: z.string().optional().nullable(),
  number_for_brand_detection: z.string().min(12).max(22),
});

export const updateCardSchema = z.object({
  bank_id: z.string().min(1).optional().nullable(),
  bank_name: z.string().min(1).optional(),
  card_type: z.enum(["credit", "debit"]).optional(),
  nickname: z.string().optional().nullable(),
  /** If set, `brand` and `last4` are recomputed from PAN (full number is not stored). */
  number_for_brand_detection: z.string().min(12).max(22).optional(),
});

export const createWalletSchema = z.object({
  name: z.string().min(1),
  nickname: z
    .string()
    .max(128)
    .optional()
    .nullable()
    .transform((s) => (s == null || s.trim() === "" ? null : s.trim())),
  current_balance: amountNonNegative.optional(),
});

export const updateWalletSchema = createWalletSchema.partial();

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
