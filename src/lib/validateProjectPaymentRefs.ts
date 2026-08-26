import type { Response } from "express";

import type { PaymentInstrumentRepository } from "../repositories/paymentInstrumentRepository.js";

type PaymentRefs = {
  bank_account_id?: string | null;
  card_id?: string | null;
  wallet_id?: string | null;
};

export async function assertPaymentRefsForProject(
  projectId: string,
  payment: PaymentRefs,
  repo: PaymentInstrumentRepository,
  res: Response
): Promise<boolean> {
  if (payment.bank_account_id) {
    const account = await repo.getBankAccountForProject(projectId, payment.bank_account_id);
    if (!account) {
      res.status(400).json({ error: "Invalid bank_account_id for this project" });
      return false;
    }
  }

  if (payment.card_id) {
    const card = await repo.getCardForProject(projectId, payment.card_id);
    if (!card) {
      res.status(400).json({ error: "Invalid card_id for this project" });
      return false;
    }
  }

  return true;
}
