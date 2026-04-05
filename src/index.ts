import "dotenv/config";

import cors from "cors";
import express from "express";
import { loadEnv } from "./config/env.js";
import { clerkAuthMiddleware } from "./middleware/clerkAuth.js";
import { ensureUserMiddleware } from "./middleware/ensureUser.js";
import { CategoryRepository } from "./repositories/categoryRepository.js";
import { TransactionRepository } from "./repositories/transactionRepository.js";
import { BudgetRepository } from "./repositories/budgetRepository.js";
import { BudgetOccurrenceRepository } from "./repositories/budgetOccurrenceRepository.js";
import { AnalyticsService } from "./services/analyticsService.js";
import { apiV1Router } from "./routes/apiV1.js";
import { internalController } from "./controllers/internalController.js";
import { clerkWebhookController } from "./controllers/clerkWebhookController.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { UserRepository } from "./repositories/userRepository.js";
import { ClerkUserSyncService } from "./services/clerkUserSyncService.js";

const env = loadEnv();

const categories = new CategoryRepository();
const transactions = new TransactionRepository();
const budgets = new BudgetRepository();
const occurrences = new BudgetOccurrenceRepository();
const analytics = new AnalyticsService(budgets, occurrences, transactions, categories);

const userRepo = new UserRepository();
const clerkUserSync = new ClerkUserSyncService(env, userRepo);
const ensureUser = ensureUserMiddleware(clerkUserSync);

const auth = clerkAuthMiddleware(env);
const app = express();

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

if (env.CLERK_WEBHOOK_SIGNING_SECRET) {
  app.post(
    "/webhooks/clerk",
    express.raw({ type: "application/json" }),
    asyncHandler(clerkWebhookController(env, userRepo))
  );
}

app.use(express.json());

const internal = internalController(env, budgets);

/** Cron-friendly stub: GET /internal/due-soon?user_id=<clerk_user_id> — optional X-Cron-Secret or ?secret= if INTERNAL_CRON_SECRET is set. No DB writes. */
app.get("/internal/due-soon", asyncHandler((req, res) => internal.dueSoon(req, res)));

app.use("/api/v1", auth, ensureUser, apiV1Router({ categories, transactions, budgets, occurrences, analytics }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.PORT, () => {
  console.log(`Balancio API listening on http://localhost:${env.PORT}`);
});
