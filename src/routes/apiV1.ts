import { Router } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { categoryController } from "../controllers/categoryController.js";
import { transactionController } from "../controllers/transactionController.js";
import { budgetController } from "../controllers/budgetController.js";
import { summaryController } from "../controllers/summaryController.js";
import { projectController } from "../controllers/projectController.js";
import { goalController } from "../controllers/goalController.js";
import { userProfileController } from "../controllers/userProfileController.js";
import { paymentInstrumentController } from "../controllers/paymentInstrumentController.js";
import type { CategoryRepository } from "../repositories/categoryRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import type { BudgetRepository } from "../repositories/budgetRepository.js";
import type { AnalyticsService } from "../services/analyticsService.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import type { UserRepository } from "../repositories/userRepository.js";
import type { GoalRepository } from "../repositories/goalRepository.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import { BANK_CATALOG } from "../data/banks.js";
import { statementUploadMiddleware } from "../middleware/statementUpload.js";

export function apiV1Router(deps: {
  categories: CategoryRepository;
  transactions: TransactionRepository;
  budgets: BudgetRepository;
  analytics: AnalyticsService;
  projects: ProjectRepository;
  users: UserRepository;
  goals: GoalRepository;
  paymentInstruments: PaymentInstrumentRepository;
}) {
  const r = Router();
  const proj = projectController(deps.projects, deps.users);
  const prof = userProfileController(deps.users);
  const cat = categoryController(deps.categories, deps.projects);
  const tx = transactionController(deps.transactions, deps.categories, deps.paymentInstruments);
  const bud = budgetController(deps.budgets, deps.transactions, deps.categories, deps.projects);
  const sum = summaryController(deps.analytics, deps.projects);
  const gl = goalController(deps.goals, deps.categories, deps.projects);
  const pay = paymentInstrumentController(deps.paymentInstruments, deps.transactions);

  const pr = Router();
  r.use("/projects", pr);

  pr.get("/", asyncHandler((req, res) => proj.listMine(req as AuthedRequest, res)));
  pr.post("/", asyncHandler((req, res) => proj.create(req as AuthedRequest, res)));

  pr.get("/:projectId", asyncHandler((req, res) => proj.get(req as AuthedRequest, res)));
  pr.patch("/:projectId", asyncHandler((req, res) => proj.update(req as AuthedRequest, res)));
  pr.delete("/:projectId", asyncHandler((req, res) => proj.remove(req as AuthedRequest, res)));

  pr.post("/:projectId/invitations", asyncHandler((req, res) => proj.invite(req as AuthedRequest, res)));
  pr.get("/:projectId/invitations", asyncHandler((req, res) => proj.listInvitations(req as AuthedRequest, res)));
  pr.post(
    "/:projectId/invitations/:invitationId/revoke",
    asyncHandler((req, res) => proj.revokeInvitation(req as AuthedRequest, res))
  );

  pr.get("/:projectId/categories", asyncHandler((req, res) => cat.list(req as AuthedRequest, res)));
  pr.post("/:projectId/categories", asyncHandler((req, res) => cat.create(req as AuthedRequest, res)));

  pr.get(
    "/:projectId/bank-accounts",
    asyncHandler((req, res) => pay.listBanksForProject(req as AuthedRequest, res))
  );

  pr.get("/:projectId/transactions", asyncHandler((req, res) => tx.list(req as AuthedRequest, res)));
  pr.post("/:projectId/transactions", asyncHandler((req, res) => tx.create(req as AuthedRequest, res)));
  pr.patch(
    "/:projectId/transactions/:transactionId",
    asyncHandler((req, res) => tx.update(req as AuthedRequest, res))
  );
  pr.delete(
    "/:projectId/transactions/:transactionId",
    asyncHandler((req, res) => tx.remove(req as AuthedRequest, res))
  );
  pr.post(
    "/:projectId/transactions/import-statement/preview",
    statementUploadMiddleware,
    asyncHandler((req, res) => tx.previewImportStatement(req as AuthedRequest, res))
  );
  pr.post(
    "/:projectId/transactions/import-statement/confirm",
    asyncHandler((req, res) => tx.confirmImportStatement(req as AuthedRequest, res))
  );

  pr.get("/:projectId/budgets", asyncHandler((req, res) => bud.list(req as AuthedRequest, res)));
  pr.post("/:projectId/budgets", asyncHandler((req, res) => bud.create(req as AuthedRequest, res)));
  pr.get("/:projectId/budgets/:budgetId", asyncHandler((req, res) => bud.get(req as AuthedRequest, res)));
  pr.patch("/:projectId/budgets/:budgetId", asyncHandler((req, res) => bud.update(req as AuthedRequest, res)));
  pr.delete("/:projectId/budgets/:budgetId", asyncHandler((req, res) => bud.remove(req as AuthedRequest, res)));
  pr.get(
    "/:projectId/budgets/:budgetId/occurrences",
    asyncHandler((req, res) => bud.listOccurrences(req as AuthedRequest, res))
  );
  pr.patch(
    "/:projectId/budgets/:budgetId/occurrences/:dueDate",
    asyncHandler((req, res) => bud.patchOccurrence(req as AuthedRequest, res))
  );

  pr.get("/:projectId/summary", asyncHandler((req, res) => sum.get(req as AuthedRequest, res)));

  pr.get("/:projectId/goals", asyncHandler((req, res) => gl.list(req as AuthedRequest, res)));
  pr.post("/:projectId/goals", asyncHandler((req, res) => gl.create(req as AuthedRequest, res)));
  pr.delete("/:projectId/goals/:goalId", asyncHandler((req, res) => gl.remove(req as AuthedRequest, res)));

  r.get("/banks", (_req, res) => {
    res.json(BANK_CATALOG);
  });

  r.get("/bank-accounts", asyncHandler((req, res) => pay.listBanks(req as AuthedRequest, res)));
  r.post("/bank-accounts", asyncHandler((req, res) => pay.createBank(req as AuthedRequest, res)));
  r.patch("/bank-accounts/:id", asyncHandler((req, res) => pay.updateBank(req as AuthedRequest, res)));
  r.delete("/bank-accounts/:id", asyncHandler((req, res) => pay.deleteBank(req as AuthedRequest, res)));

  r.get("/cards", asyncHandler((req, res) => pay.listCards(req as AuthedRequest, res)));
  r.post("/cards", asyncHandler((req, res) => pay.createCard(req as AuthedRequest, res)));
  r.patch("/cards/:id", asyncHandler((req, res) => pay.updateCard(req as AuthedRequest, res)));
  r.delete("/cards/:id", asyncHandler((req, res) => pay.deleteCard(req as AuthedRequest, res)));

  r.get("/wallets", asyncHandler((req, res) => pay.listWallets(req as AuthedRequest, res)));
  r.post("/wallets", asyncHandler((req, res) => pay.createWallet(req as AuthedRequest, res)));
  r.patch("/wallets/:id", asyncHandler((req, res) => pay.updateWallet(req as AuthedRequest, res)));
  r.delete("/wallets/:id", asyncHandler((req, res) => pay.deleteWallet(req as AuthedRequest, res)));

  r.get("/me/profile-complete", asyncHandler((req, res) => prof.profileComplete(req as AuthedRequest, res)));
  r.get("/me", asyncHandler((req, res) => prof.getMe(req as AuthedRequest, res)));
  r.patch("/me", asyncHandler((req, res) => prof.patchMe(req as AuthedRequest, res)));

  r.get("/invitations/pending", asyncHandler((req, res) => proj.pendingInvitesForMe(req as AuthedRequest, res)));
  r.post("/invitations/:invitationId/accept", asyncHandler((req, res) => proj.acceptInvite(req as AuthedRequest, res)));
  r.post("/invitations/:invitationId/deny", asyncHandler((req, res) => proj.denyInvite(req as AuthedRequest, res)));

  return r;
}
