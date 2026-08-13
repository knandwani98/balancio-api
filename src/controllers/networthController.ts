import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import { networthQuerySchema } from "../models/schemas.js";
import type { InvestmentPlanRepository } from "../repositories/investmentPlanRepository.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import { assertProjectMember } from "../lib/projectAuthz.js";

type NetworthSection = "investments" | "banks" | "insurance" | "cards" | "bills";

const ASSET_SECTIONS = new Set<NetworthSection>(["investments", "banks", "insurance"]);
const LIABILITY_SECTIONS = new Set<NetworthSection>(["cards", "bills"]);

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
        cards?: { total_value: number };
        bills?: { total_value: number };
        assets: number;
        liabilities: number;
        networth: number;
        total_value: number;
      } = { assets: 0, liabilities: 0, networth: 0, total_value: 0 };

      if (sections.has("investments")) {
        const investments = await investmentPlans.networthStats(projectId);
        body.investments = investments;
        body.assets += investments.total_value;
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
        body.assets += banks.total_value;
      }

      if (sections.has("insurance")) {
        body.insurance = { total_value: 0 };
      }

      if (sections.has("cards")) {
        const creditCards = (await paymentInstruments.listCards(req.userId)).filter(
          (card) => card.card_type === "credit"
        );
        const cardBalances = await Promise.all(
          creditCards.map((card) =>
            transactions.computeCreditCardOutstanding(card.id, projectId)
          )
        );
        const cards = {
          total_value: cardBalances.reduce((sum, balance) => sum + balance, 0),
        };
        body.cards = cards;
        body.liabilities += cards.total_value;
      }

      if (sections.has("bills")) {
        const bills = {
          total_value: await transactions.sumDueAndOverdueBills(projectId),
        };
        body.bills = bills;
        body.liabilities += bills.total_value;
      }

      body.networth = body.assets - body.liabilities;
      const requestedAssets = [...sections].some((section) => ASSET_SECTIONS.has(section));
      const requestedLiabilities = [...sections].some((section) =>
        LIABILITY_SECTIONS.has(section)
      );
      body.total_value = requestedLiabilities
        ? body.networth
        : requestedAssets
          ? body.assets
          : 0;

      res.json(body);
    },
  };
}
