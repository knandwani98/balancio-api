import type { PlanHoldingTransaction } from "@prisma/client";

export function toPlanHoldingTransactionRow(t: PlanHoldingTransaction) {
  return {
    id: t.id,
    holding_id: t.holding_id,
    txn_date: t.txn_date.toISOString().slice(0, 10),
    nav: t.nav.toNumber(),
    units: t.units.toNumber(),
    amount: t.amount.toNumber(),
    invested: t.invested.toNumber(),
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
  };
}
