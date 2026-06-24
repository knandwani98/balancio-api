import type { PlanHolding } from "@prisma/client";

export function toPlanHoldingRow(h: PlanHolding) {
  return {
    id: h.id,
    plan_id: h.plan_id,
    name: h.name,
    badge: h.badge,
    badge_class_name: h.badge_class_name,
    fund_type: h.fund_type,
    asset_type: h.asset_type,
    asset_metal: h.asset_metal,
    asset_other_name: h.asset_other_name,
    broker: h.broker,
    broker_name: h.broker_name,
    invested: h.invested.toNumber(),
    current_nav: h.current_nav?.toNumber() ?? null,
    current_value: h.current_value.toNumber(),
    one_day_change: h.one_day_change.toNumber(),
    one_day_change_pct: h.one_day_change_pct.toNumber(),
    sort_order: h.sort_order,
    created_at: h.created_at.toISOString(),
    updated_at: h.updated_at.toISOString(),
  };
}
