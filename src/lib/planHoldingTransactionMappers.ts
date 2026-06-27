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

export function toPlanOrderTransactionRow(
  t: PlanHoldingTransaction & {
    holding: {
      id: string;
      name: string;
      broker: string;
      broker_name: string | null;
      fund_type: string;
      asset_type: string;
      asset_metal: string | null;
      asset_other_name: string | null;
    };
  }
) {
  return {
    ...toPlanHoldingTransactionRow(t),
    holding_name: t.holding.name,
    broker: t.holding.broker,
    broker_name: t.holding.broker_name,
    fund_type: t.holding.fund_type,
    asset_type: t.holding.asset_type,
    asset_metal: t.holding.asset_metal,
    asset_other_name: t.holding.asset_other_name,
  };
}
