import {
  isStatementImportBankId,
  type StatementImportBankId,
} from "./parseStatement.js";

export function resolveStatementImportBankId(account: {
  bank_id: string | null;
  bank_name: string;
}): StatementImportBankId | null {
  if (account.bank_id != null && isStatementImportBankId(account.bank_id)) {
    return account.bank_id;
  }
  const name = account.bank_name.trim().toLowerCase();
  if (name.includes("kotak")) return "kotak";
  if (name.includes("bank of india")) return "boi";
  return null;
}

export function isImportableBankAccount(account: {
  bank_id: string | null;
  bank_name: string;
}): boolean {
  return resolveStatementImportBankId(account) != null;
}
