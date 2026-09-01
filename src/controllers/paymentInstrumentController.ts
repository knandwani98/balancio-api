import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import type { TransactionRepository } from "../repositories/transactionRepository.js";
import {
  createBankAccountSchema,
  createCardSchema,
  createWalletSchema,
  adjustBankBalanceSchema,
  updateBankAccountSchema,
  updateCardSchema,
  updateWalletSchema,
} from "../models/schemas.js";
import { bankById } from "../data/banks.js";
import { toBankAccountRow } from "../lib/bankAccountMapper.js";
import { toCardRow } from "../lib/cardMapper.js";
import { toWalletRow } from "../lib/walletMapper.js";
import { assertProjectMember } from "../lib/projectAuthz.js";
import { getCardType, getLast4 } from "../utils/cardBrand.js";

function creditFieldsForType(
  cardType: "credit" | "debit",
  input: {
    credit_limit?: number | null;
    statement_day?: number | null;
    payment_day?: number | null;
  }
) {
  if (cardType === "debit") {
    return { credit_limit: null, statement_day: null, payment_day: null };
  }
  return {
    credit_limit: input.credit_limit ?? null,
    statement_day: input.statement_day ?? null,
    payment_day: input.payment_day ?? null,
  };
}

/**
 * Payment instruments scoped to projects (banks, cards). Wallets remain user-scoped.
 * PCI: full card numbers are not persisted; see createCardSchema and getCardType().
 */
export function paymentInstrumentController(
  repo: PaymentInstrumentRepository,
  transactions: TransactionRepository
) {
  async function loadProjectBankAccounts(
    req: AuthedRequest,
    res: Response,
    importableOnly: boolean
  ) {
    const projectId = String(req.params.projectId);
    await assertProjectMember(req.userId, projectId);
    const rows = importableOnly
      ? await repo.listImportableBankAccounts(projectId)
      : await repo.listBankAccounts(projectId);
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...toBankAccountRow(row),
        current_balance: await transactions.computeNetBalanceForBankAccount(row.id, projectId),
      }))
    );
    res.json(enriched);
  }

  return {
    listBanksForProject: async (req: AuthedRequest, res: Response) => {
      const importableOnly =
        req.query.importable === "true" || req.query.importable === "1";
      await loadProjectBankAccounts(req, res, importableOnly);
    },
    createBankForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const row = await repo.createBankAccount(req.userId, projectId, parsed.data);
      res.status(201).json(toBankAccountRow(row));
    },
    updateBankForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = updateBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const n = await repo.updateBankAccount(
        projectId,
        String(req.params.id),
        parsed.data
      );
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    adjustBankBalanceForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = adjustBankBalanceSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const bankAccountId = String(req.params.id);
      const account = await repo.getBankAccountForProject(projectId, bankAccountId);
      if (!account) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const txnNet = await transactions.computeClearedTransactionNetForBankAccount(
        bankAccountId,
        projectId
      );
      const ledgerBaseline = parsed.data.balance - txnNet;
      await repo.setBankAccountLedgerBaseline(projectId, bankAccountId, ledgerBaseline);
      const current_balance = await transactions.computeNetBalanceForBankAccount(
        bankAccountId,
        projectId
      );
      res.json({ ok: true, current_balance });
    },
    deleteBankForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const n = await repo.deleteBankAccount(projectId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },

    listCardsForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const rows = await repo.listCards(projectId);
      res.json(rows.map(toCardRow));
    },
    createCardForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = createCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const pan = d.number_for_brand_detection;
      const brand = d.brand ?? getCardType(pan);
      const row = await repo.createCard(req.userId, projectId, {
        bank_id: d.bank_id ?? null,
        bank_name: d.bank_name,
        card_type: d.card_type,
        last4: getLast4(pan),
        brand,
        nickname: d.nickname,
        ...creditFieldsForType(d.card_type, d),
      });
      res.status(201).json(toCardRow(row));
    },
    updateCardForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const parsed = updateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const existing = await repo.getCardForProject(projectId, String(req.params.id));
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const patch: {
        bank_id?: string | null;
        bank_name?: string;
        card_type?: "credit" | "debit";
        last4?: string;
        brand?: string;
        nickname?: string | null;
        icon_url?: string | null;
        credit_limit?: number | null;
        statement_day?: number | null;
        payment_day?: number | null;
      } = {};
      if (d.bank_id !== undefined) {
        patch.bank_id = d.bank_id ?? null;
        const catalog = d.bank_id ? bankById(d.bank_id) : undefined;
        patch.icon_url = catalog?.logo_url ?? null;
      }
      if (d.bank_name !== undefined) patch.bank_name = d.bank_name;
      if (d.card_type !== undefined) patch.card_type = d.card_type;
      if (d.nickname !== undefined) {
        patch.nickname =
          d.nickname == null || (typeof d.nickname === "string" && d.nickname.trim() === "")
            ? null
            : String(d.nickname).trim();
      }
      if (d.number_for_brand_detection) {
        const pan = d.number_for_brand_detection;
        patch.brand = getCardType(pan);
        patch.last4 = getLast4(pan);
      }
      const nextType = d.card_type ?? existing.card_type;
      if (nextType === "debit") {
        patch.credit_limit = null;
        patch.statement_day = null;
        patch.payment_day = null;
      } else {
        if (d.credit_limit !== undefined) patch.credit_limit = d.credit_limit;
        if (d.statement_day !== undefined) patch.statement_day = d.statement_day;
        if (d.payment_day !== undefined) patch.payment_day = d.payment_day;
      }
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "No updates" });
        return;
      }
      const n = await repo.updateCard(projectId, String(req.params.id), patch);
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    deleteCardForProject: async (req: AuthedRequest, res: Response) => {
      const projectId = String(req.params.projectId);
      await assertProjectMember(req.userId, projectId);
      const n = await repo.deleteCard(projectId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },

    listWallets: async (req: AuthedRequest, res: Response) => {
      const rows = await repo.listWallets(req.userId);
      const enriched = await Promise.all(
        rows.map(async (row) => ({
          ...toWalletRow(row),
          current_balance: await transactions.computeNetBalanceForWallet(row.id),
        }))
      );
      res.json(enriched);
    },
    createWallet: async (req: AuthedRequest, res: Response) => {
      const parsed = createWalletSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const row = await repo.createWallet(req.userId, parsed.data);
      res.status(201).json(toWalletRow(row));
    },
    updateWallet: async (req: AuthedRequest, res: Response) => {
      const parsed = updateWalletSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const n = await repo.updateWallet(req.userId, String(req.params.id), parsed.data);
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    deleteWallet: async (req: AuthedRequest, res: Response) => {
      const n = await repo.deleteWallet(req.userId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },
  };
}
