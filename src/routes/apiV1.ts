import { Router } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { categoryController } from "../controllers/categoryController.js";
import { transactionController } from "../controllers/transactionController.js";
import { budgetController } from "../controllers/budgetController.js";
import { summaryController } from "../controllers/summaryController.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { BudgetOccurrenceRepository } from "../repositories/budgetOccurrenceRepository.js";
import type { AnalyticsService } from "../services/analyticsService.js";

export function apiV1Router(deps: {
  categories: CategoryRepository;
  transactions: TransactionRepository;
  budgets: BudgetRepository;
  occurrences: BudgetOccurrenceRepository;
  analytics: AnalyticsService;
}) {
  const r = Router();
  const cat = categoryController(deps.categories);
  const tx = transactionController(
    deps.transactions,
    deps.categories,
    deps.occurrences,
    deps.budgets
  );
  const bud = budgetController(deps.budgets, deps.occurrences, deps.categories);
  const sum = summaryController(deps.analytics);
  
  
  // TODO: Seperate all routes in their own files
  r.get("/categories", asyncHandler((req, res) => cat.list(req as AuthedRequest, res)));
  r.post("/categories", asyncHandler((req, res) => cat.create(req as AuthedRequest, res)));

  r.get("/transactions", asyncHandler((req, res) => tx.list(req as AuthedRequest, res)));
  r.post("/transactions", asyncHandler((req, res) => tx.create(req as AuthedRequest, res)));

  r.get("/budgets", asyncHandler((req, res) => bud.list(req as AuthedRequest, res)));
  r.post("/budgets", asyncHandler((req, res) => bud.create(req as AuthedRequest, res)));
  r.get("/budgets/:id", asyncHandler((req, res) => bud.get(req as AuthedRequest, res)));
  r.patch("/budgets/:id", asyncHandler((req, res) => bud.update(req as AuthedRequest, res)));
  r.delete("/budgets/:id", asyncHandler((req, res) => bud.remove(req as AuthedRequest, res)));
  r.get(
    "/budgets/:id/occurrences",
    asyncHandler((req, res) => bud.listOccurrences(req as AuthedRequest, res))
  );
  r.patch(
    "/budgets/:id/occurrences/:periodStart",
    asyncHandler((req, res) => bud.patchOccurrence(req as AuthedRequest, res))
  );

  r.get("/summary", asyncHandler((req, res) => sum.get(req as AuthedRequest, res)));

  return r;
}
