import type { ParsedStatementResult, StatementImportBankId } from "./types.js";
import { parseBoiStatement } from "./boiParser.js";
import { parseKotakStatement } from "./kotakParser.js";

export type { ParsedStatementLine, ParsedStatementResult, StatementImportBankId } from "./types.js";

export const STATEMENT_IMPORT_BANK_IDS: readonly StatementImportBankId[] = ["kotak", "boi"];

export function isStatementImportBankId(id: string): id is StatementImportBankId {
  return id === "kotak" || id === "boi";
}

export function parseBankStatement(
  bankId: StatementImportBankId,
  text: string
): ParsedStatementResult {
  const parsed =
    bankId === "kotak" ? parseKotakStatement(text) : parseBoiStatement(text);
  return {
    lines: parsed.lines.filter((l) => l.amount > 0),
    opening_balance: parsed.opening_balance,
    closing_balance: parsed.closing_balance,
  };
}
