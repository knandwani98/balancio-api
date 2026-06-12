import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3001),
  CLERK_SECRET_KEY: z.string().min(1),
  /** From Clerk Dashboard → Webhooks → signing secret; optional locally if you only use lazy sync on API calls. */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  FRONTEND_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/$/, ""))
    .default("http://localhost:3000"),
  INTERNAL_CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error(
      "Invalid environment variables. From the backend folder, copy .env.example to .env and set CLERK_SECRET_KEY, DATABASE_URL, and DIRECT_URL (Neon pooled + direct)."
    );
  }
  return parsed.data;
}
