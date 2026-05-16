import "./instrument.js";
import "dotenv/config";

import * as Sentry from "@sentry/node";
import cors from "cors";
import express from "express";
import { loadEnv } from "./config/env.js";
import { clerkAuthMiddleware } from "./middleware/clerkAuth.js";
import { ensureUserMiddleware } from "./middleware/ensureUser.js";
import { CategoryRepository } from "./repositories/categoryRepository.js";
import { TransactionRepository } from "./repositories/transactionRepository.js";
import { BudgetRepository } from "./repositories/budgetRepository.js";
import { BudgetOccurrenceRepository } from "./repositories/budgetOccurrenceRepository.js";
import { GoalRepository } from "./repositories/goalRepository.js";
import { AnalyticsService } from "./services/analyticsService.js";
import { apiV1Router } from "./routes/apiV1.js";
import { internalController } from "./controllers/internalController.js";
import { clerkWebhookController } from "./controllers/clerkWebhookController.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { UserRepository } from "./repositories/userRepository.js";
import { ClerkUserSyncService } from "./services/clerkUserSyncService.js";
import { ProjectRepository } from "./repositories/projectRepository.js";
import { PaymentInstrumentRepository } from "./repositories/paymentInstrumentRepository.js";

const env = loadEnv();

const categories = new CategoryRepository();
const transactions = new TransactionRepository();
const budgets = new BudgetRepository();
const occurrences = new BudgetOccurrenceRepository();
const goals = new GoalRepository();
const projects = new ProjectRepository();
const paymentInstruments = new PaymentInstrumentRepository();
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

/** POST /internal/recurring/tick — optional ?date=YYYY-MM-DD (default UTC today). Updates occurrence schedule_status. */
app.post("/internal/recurring/tick", asyncHandler((req, res) => internal.recurringTick(req, res)));

app.use(
  "/api/v1",
  auth,
  ensureUser,
  apiV1Router({
    categories,
    transactions,
    budgets,
    occurrences,
    analytics,
    projects,
    users: userRepo,
    goals,
    paymentInstruments,
  })
);

app.get("/debug-sentry", (_req, _res) => {
  throw new Error("My first Sentry error!");
});

Sentry.setupExpressErrorHandler(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const status =
    err !== null &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
  if (status !== 500) {
    res.status(status).json({ error: err instanceof Error ? err.message : "Error" });
    return;
  }
  const sentryId = "sentry" in res && typeof (res as express.Response & { sentry?: string }).sentry === "string"
    ? (res as express.Response & { sentry?: string }).sentry
    : undefined;
  res.status(500).json({
    error: "Internal server error",
    ...(sentryId !== undefined && { sentry: sentryId }),
  });
});

app.listen(env.PORT, () => {
  console.log(`Balancio API listening on http://localhost:${env.PORT}`);
});
