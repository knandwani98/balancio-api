import type { Wallet } from "@prisma/client";

export function toWalletRow(row: Wallet) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    nickname: row.nickname,
    current_balance: row.current_balance.toNumber(),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
