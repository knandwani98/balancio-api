import type { Response } from "express";
import type { AuthedRequest } from "../middleware/clerkAuth.js";
import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";
import {
  createBankAccountSchema,
  createCardSchema,
  createUpiProfileSchema,
  updateBankAccountSchema,
  updateCardSchema,
  updateUpiProfileSchema,
} from "../models/schemas.js";
import { getCardType } from "../utils/cardBrand.js";

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
      const brand =
        d.brand ??
        (d.number_for_brand_detection ? getCardType(d.number_for_brand_detection) : "Unknown");
      const row = await repo.createCard(req.userId, {
        card_type: d.card_type,
        last4: d.last4,
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
      const n = await repo.updateCard(req.userId, String(req.params.id), parsed.data);
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

    listUpi: async (req: AuthedRequest, res: Response) => {
      const rows = await repo.listUpiProfiles(req.userId);
      res.json(rows);
    },
    createUpi: async (req: AuthedRequest, res: Response) => {
      const parsed = createUpiProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const row = await repo.createUpiProfile(req.userId, parsed.data);
      res.status(201).json(row);
    },
    updateUpi: async (req: AuthedRequest, res: Response) => {
      const parsed = updateUpiProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }
      const n = await repo.updateUpiProfile(req.userId, String(req.params.id), parsed.data);
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json({ ok: true });
    },
    deleteUpi: async (req: AuthedRequest, res: Response) => {
      const n = await repo.deleteUpiProfile(req.userId, String(req.params.id));
      if (n.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    },
  };
}
