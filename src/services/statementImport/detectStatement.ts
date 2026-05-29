import type { StatementImportBankId } from "./types.js";
import { parseBankStatement } from "./parseStatement.js";
import type { ParsedStatementResult } from "./types.js";

export type StatementDetection = {
  bankId: StatementImportBankId | null;
  accountNumberDigits: string | null;
};

export function detectStatementImport(text: string): StatementDetection {
  const lower = text.toLowerCase();
  let kotakScore = 0;
  let boiScore = 0;

  if (lower.includes("kotak")) kotakScore += 2;
  if (lower.includes("kotak mahindra")) kotakScore += 1;
  if (/savings account transactions/i.test(text)) kotakScore += 2;
  if (/account statement\d{2} \w+ \d{4}/i.test(text)) kotakScore += 1;

  if (lower.includes("bank of india")) boiScore += 3;
  if (/detailed statement/i.test(text)) boiScore += 2;
  if (/sr nodateremarks/i.test(lower.replace(/\s/g, ""))) boiScore += 2;

  let bankId: StatementImportBankId | null = null;
  if (kotakScore > boiScore && kotakScore > 0) bankId = "kotak";
  else if (boiScore > kotakScore && boiScore > 0) bankId = "boi";
  else if (kotakScore > 0) bankId = "kotak";
  else if (boiScore > 0) bankId = "boi";

  const accountNumberDigits = extractAccountNumberDigits(text);

  return { bankId, accountNumberDigits };
}

function extractAccountNumberDigits(text: string): string | null {
  const patterns = [
    /Account\s*No\.?\s*(\d[\d\s-]{8,18})/i,
    /Account\s*number\s*[:\s]*(\d[\d\s-]{8,18})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const digits = m[1].replace(/\D/g, "");
      if (digits.length >= 8) return digits;
    }
  }
  return null;
}

export function parseStatementWithDetection(text: string): {
  bankId: StatementImportBankId;
  result: ParsedStatementResult;
  detection: StatementDetection;
} {
  const detection = detectStatementImport(text);
  if (detection.bankId) {
    const result = parseBankStatement(detection.bankId, text);
    if (result.lines.length > 0) {
      return { bankId: detection.bankId, result, detection };
    }
  }

  const kotak = parseBankStatement("kotak", text);
  const boi = parseBankStatement("boi", text);
  if (kotak.lines.length >= boi.lines.length && kotak.lines.length > 0) {
    return { bankId: "kotak", result: kotak, detection: { ...detection, bankId: "kotak" } };
  }
  if (boi.lines.length > 0) {
    return { bankId: "boi", result: boi, detection: { ...detection, bankId: "boi" } };
  }

  throw new Error("No transactions found in statement");
}
