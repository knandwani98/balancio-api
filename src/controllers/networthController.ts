import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import { networthQuerySchema } from "../models/schemas.js";
import type { InvestmentPlanRepository } from "../repositories/investmentPlanRepository.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

type NetworthSection = "investments" | "banks" | "insurance";

export function networthController(
  investmentPlans: InvestmentPlanRepository,
  paymentInstruments: PaymentInstrumentRepository,
  transactions: TransactionRepository
) {
  return {
    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);

      const parsed = networthQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const sections = new Set<NetworthSection>(parsed.data.sections);
      const body: {
        investments?: { total_value: number };
        banks?: { total_value: number };
        insurance?: { total_value: number };
        total_value: number;
      } = { total_value: 0 };

      if (sections.has("investments")) {
        const investments = await investmentPlans.networthStats(projectId);
        body.investments = investments;
        body.total_value += investments.total_value;
      }

      if (sections.has("banks")) {
        const bankAccounts = await paymentInstruments.listBankAccounts(req.userId);
        const bankBalances = await Promise.all(
          bankAccounts.map(async (account) =>
            transactions.computeNetBalanceForBankAccount(account.id, projectId)
          )
        );
        const banks = {
          total_value: bankBalances.reduce((sum, balance) => sum + balance, 0),
        };
        body.banks = banks;
        body.total_value += banks.total_value;
      }

      if (sections.has("insurance")) {
        body.insurance = { total_value: 0 };
      }

      res.json(body);
    },
  };
}
