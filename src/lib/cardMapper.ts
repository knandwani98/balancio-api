import type { Card } from "@prisma/client";

export function toCardRow(row: Card) {
  return {
    id: row.id,
    bank_id: row.bank_id,
    bank_name: row.bank_name,
    card_type: row.card_type,
    last4: row.last4,
    brand: row.brand,
    nickname: row.nickname,
    icon_url: row.icon_url,
    credit_limit: row.credit_limit?.toNumber() ?? null,
    statement_day: row.statement_day,
    payment_day: row.payment_day,
  };
}
