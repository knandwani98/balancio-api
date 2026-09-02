import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { InvestmentPlanRepository } from "../repositories/investmentPlanRepository.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

export function networthController(
  investmentPlans: InvestmentPlanRepository,
  paymentInstruments: PaymentInstrumentRepository,
  transactions: TransactionRepository
) {
  return {
    get: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);

      const investments = await investmentPlans.networthStats(projectId);
      const bankAccounts = await paymentInstruments.listBankAccounts(projectId);
      const bankBalances = await Promise.all(
        bankAccounts.map(async (account) =>
          transactions.computeNetBalanceForBankAccount(account.id, projectId)
        )
      );
      const banksTotal = bankBalances.reduce((sum, balance) => sum + balance, 0);

      const creditCards = (await paymentInstruments.listCards(projectId)).filter(
        (card) => card.card_type === "credit"
      );
      const cardBalances = await Promise.all(
        creditCards.map((card) =>
          transactions.computeCreditCardOutstanding(card.id, projectId)
        )
      );
      const cardsTotal = cardBalances.reduce((sum, balance) => sum + balance, 0);
      const billsTotal = await transactions.sumDueAndOverdueBills(projectId);

      const assets = investments.total_value + banksTotal;
      const liabilities = cardsTotal + billsTotal;
      const networth = assets - liabilities;

      res.json({
        assets,
        liabilities,
        networth,
        investments: investments.total_value,
        banks: banksTotal,
      });
    },
  };
}
