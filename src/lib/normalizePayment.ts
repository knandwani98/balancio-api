import type { PaymentMethod } from "../types/database.js";

export function normalizePaymentRefs(
  pm: PaymentMethod,
  refs: {
    bank_account_id?: string | null;
    card_id?: string | null;
    wallet_id?: string | null;
  }
): {
  payment_method: PaymentMethod;
  bank_account_id: string | null;
  card_id: string | null;
  wallet_id: string | null;
} {
  return {
    payment_method: pm,
    bank_account_id: pm === "bank" ? (refs.bank_account_id ?? null) : null,
    card_id: pm === "cards" ? (refs.card_id ?? null) : null,
    wallet_id: pm === "wallet" ? (refs.wallet_id ?? null) : null,
  };
}
