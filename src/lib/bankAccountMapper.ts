import type { BankAccount } from "@prisma/client";

export function toBankAccountRow(row: BankAccount) {
  return {
    id: row.id,
    createdBy: row.createdBy,
    bank_id: row.bank_id,
    bank_name: row.bank_name,
    nickname: row.nickname,
    account_number: row.account_number,
    account_type: row.account_type,
    current_balance: row.current_balance.toNumber(),
    icon_url: row.icon_url,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
