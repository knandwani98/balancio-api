import { z } from "zod";

export const createCategorySchema = z.object({
  title: z.string().min(1),
  image_url: z.string().url().optional().nullable(),
});

export const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount_paise: z.number().int().nonnegative(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().optional().nullable(),
  note: z.string().optional().nullable(),
  budget_occurrence_id: z.string().uuid().optional().nullable(),
});

export const createBudgetSchema = z.object({
  category_id: z.string().uuid(),
  title: z.string().min(1),
  default_planned_amount_paise: z.number().int().nonnegative(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_day_of_month: z.number().int().min(1).max(31),
  recurrence: z.enum(["monthly"]).default("monthly"),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export const patchOccurrenceSchema = z.object({
  planned_amount_paise: z.number().int().nonnegative().optional().nullable(),
  actual_amount_paise: z.number().int().nonnegative().optional().nullable(),
  paid_at: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const summaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
