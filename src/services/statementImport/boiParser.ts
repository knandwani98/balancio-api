import { parseIndianAmount } from "./amountUtils.js";
import { extractBoiTransactionDetails } from "./extractTransactionDetails.js";
import type { ParsedStatementLine } from "./types.js";

const ROW_START = /(?:^|\n)(\d+)\s+(\d{2}-\d{2}-\d{4})\s+/g;

const JUNK =
  /^(?:Sr NoDateRemarks|Transaction Date|Amount|Cheque|from:|to:|Detailed Statement|Transaction type:|Account holder|Customer ID|Account number|Branch Name)/i;

function boiDateToIso(ddMmYyyy: string): string {
  const [dd, mm, yyyy] = ddMmYyyy.split("-").map((p) => parseInt(p, 10));
  if (!dd || !mm || !yyyy) throw new Error(`Invalid BOI date: ${ddMmYyyy}`);
  const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return iso;
}

function inferTypeFromRemarks(remarks: string): "income" | "expense" {
  if (/\/CR\//i.test(remarks)) return "income";
  if (/\/DR\//i.test(remarks)) return "expense";
  return "expense";
}

export function parseBoiStatement(text: string): {
  lines: ParsedStatementLine[];
  opening_balance: number | null;
  closing_balance: number | null;
} {
  const normalized = text.replace(/\r/g, "").replace(/\u00a0/g, " ");

  const starts: { index: number; serial: string; date: string }[] = [];
  let m: RegExpExecArray | null;
  ROW_START.lastIndex = 0;
  while ((m = ROW_START.exec(normalized)) !== null) {
    starts.push({ index: m.index + (m[0].startsWith("\n") ? 1 : 0), serial: m[1]!, date: m[2]! });
  }

  const out: ParsedStatementLine[] = [];
  let closing_balance: number | null = null;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : normalized.length;
    let chunk = normalized.slice(start.index, end).trim();
    chunk = chunk.replace(/^\d+\s+\d{2}-\d{2}-\d{4}\s+/, "");

    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !JUNK.test(l));

    let debit: number | null = null;
    let credit: number | null = null;
    let rowBalance: number | null = null;
    const remarkLines: string[] = [];

    for (const line of lines) {
      const balanceMatch = line.match(/^₹\s*([\d,\s]+\.\d{2})\s*$/);
      if (balanceMatch) {
        rowBalance = parseIndianAmount(balanceMatch[1]!.replace(/\s/g, ""));
        continue;
      }

      const debitMatch = line.match(/^([\d,]+\.\d{2})\s{2,}$/);
      if (debitMatch) {
        debit = parseIndianAmount(debitMatch[1]!);
        continue;
      }

      const creditMatch = line.match(/^\s+([\d,]+\.\d{2})\s*$/);
      if (creditMatch) {
        credit = parseIndianAmount(creditMatch[1]!);
        continue;
      }

      const plainAmount = line.match(/^([\d,]+\.\d{2})\s*$/);
      if (plainAmount && !line.startsWith("₹")) {
        if (credit == null && debit == null) {
          debit = parseIndianAmount(plainAmount[1]!);
        }
        continue;
      }

      remarkLines.push(line);
    }

    const remarks = remarkLines.join(" ");
    const type = credit != null ? "income" : inferTypeFromRemarks(remarks);
    const amount = credit ?? debit;
    if (amount == null || amount <= 0) continue;

    if (i === 0 && rowBalance != null) {
      closing_balance = rowBalance;
    }

    const { name, reference_no } = extractBoiTransactionDetails(remarks);

    out.push({
      statement_order: i,
      occurred_at: boiDateToIso(start.date),
      name,
      reference_no,
      type,
      amount,
      note: null,
    });
  }

  return { lines: out, opening_balance: null, closing_balance };
}
