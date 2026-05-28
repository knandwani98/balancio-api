import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import {
  createBankAccountSchema,
  createCardSchema,
  createWalletSchema,
  updateBankAccountSchema,
  updateCardSchema,
  updateWalletSchema,
} from "../models/schemas.js";
import { bankById } from "../data/banks.js";
import { getCardType, getLast4 } from "../utils/cardBrand.js";

/**
 * User-scoped payment instruments. PCI: full card numbers are not persisted; see createCardSchema
 * and getCardType() — only last4 + brand are stored.
 */
export function paymentInstrumentController(repo: PaymentInstrumentRepository) {
  return {
    listBanks: async (req: AuthedRequest, res: Response) => {
      const rows = await repo.listBankAccounts(req.userId);
      res.json(rows);
    },
    createBank: async (req: AuthedRequest, res: Response) => {
      const parsed = createBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const row = await repo.createBankAccount(req.userId, parsed.data);
      res.status(201).json(row);
    },
    updateBank: async (req: AuthedRequest, res: Response) => {
      const parsed = updateBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const n = await repo.updateBankAccount(req.userId, String(req.params.id), parsed.data);
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    deleteBank: async (req: AuthedRequest, res: Response) => {
      const n = await repo.deleteBankAccount(req.userId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },

    listCards: async (req: AuthedRequest, res: Response) => {
      const rows = await repo.listCards(req.userId);
      res.json(rows);
    },
    createCard: async (req: AuthedRequest, res: Response) => {
      const parsed = createCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const pan = d.number_for_brand_detection;
      const brand = d.brand ?? getCardType(pan);
      const row = await repo.createCard(req.userId, {
        bank_id: d.bank_id ?? null,
        bank_name: d.bank_name,
        card_type: d.card_type,
        last4: getLast4(pan),
        brand,
        nickname: d.nickname,
      });
      res.status(201).json(row);
    },
    updateCard: async (req: AuthedRequest, res: Response) => {
      const parsed = updateCardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const d = parsed.data;
      const patch: {
        bank_id?: string | null;
        bank_name?: string;
        card_type?: "credit" | "debit";
        last4?: string;
        brand?: string;
        nickname?: string | null;
        icon_url?: string | null;
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
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "No updates" });
        return;
      }
      const n = await repo.updateCard(req.userId, String(req.params.id), patch);
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    deleteCard: async (req: AuthedRequest, res: Response) => {
      const n = await repo.deleteCard(req.userId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },

    listWallets: async (req: AuthedRequest, res: Response) => {
      const rows = await repo.listWallets(req.userId);
      res.json(rows);
    },
    createWallet: async (req: AuthedRequest, res: Response) => {
      const parsed = createWalletSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const row = await repo.createWallet(req.userId, parsed.data);
      res.status(201).json(row);
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
