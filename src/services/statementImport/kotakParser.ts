import { amountsRoughlyEqual, parseIndianAmount } from "./amountUtils.js";
import { extractKotakTransactionDetails } from "./extractTransactionDetails.js";
import type { ParsedStatementLine } from "./types.js";

const MONTHS =
  "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const DATE_PATTERN = `\\d{1,2} (?:${MONTHS}) \\d{4}`;
const JUNK_LINE =
  /^(?:#DateDescription|Statement Generated|Page \d+ of|Savings Account Transactions|Account Statement|Account No\.|Kushal Nandwani$)/i;

function kotakDateToIso(dateStr: string): string {
  const d = new Date(`${dateStr} UTC`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid Kotak date: ${dateStr}`);
  }
  return d.toISOString().slice(0, 10);
}

function resolveOccurredAt(
  rowDateStr: string,
  description: string
): string {
  const valueDate = description.match(
    /Value\s*Date:\s*(\d{2})-(\d{2})-(\d{4})/i
  );
  if (valueDate) {
    return `${valueDate[3]}-${valueDate[2]}-${valueDate[1]}`;
  }
  return kotakDateToIso(rowDateStr);
}

function isValidKotakRowDate(dateStr: string): boolean {
  const day = Number(dateStr.match(/^(\d{1,2})/)?.[1]);
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;
  const d = new Date(`${dateStr} UTC`);
  return !Number.isNaN(d.getTime());
}

/** Split glued `1607 May 2026` → serial `16`, date `07 May 2026`. */
function splitSerialDateFromGlued(
  chunk: string,
  prevSerial: number
): { serial: string; dateStr: string } | null {
  if (prevSerial > 0) {
    for (let serialLen = 3; serialLen >= 1; serialLen--) {
      const re = new RegExp(`^(\\d{${serialLen}})(\\d{1,2} (?:${MONTHS}) \\d{4})`);
      const m = chunk.match(re);
      if (!m || !isValidKotakRowDate(m[2]!)) continue;
      if (parseInt(m[1]!, 10) === prevSerial + 1) {
        return { serial: m[1]!, dateStr: m[2]! };
      }
    }
  }
  for (let serialLen = 1; serialLen <= 3; serialLen++) {
    const re = new RegExp(`^(\\d{${serialLen}})(\\d{1,2} (?:${MONTHS}) \\d{4})`);
    const m = chunk.match(re);
    if (m && isValidKotakRowDate(m[2]!)) {
      return { serial: m[1]!, dateStr: m[2]! };
    }
  }
  return null;
}

/** Comma-grouped INR (excludes bogus `002,483.03` from glued UPI refs). */
const INDIAN_COMMA_AMOUNT_AT_END = /([1-9]\d{0,1}(?:,\d{2,3}){1,2}\.\d{2})$/;
const PLAIN_AMOUNT_AT_END = /(\d{1,6}\.\d{2})$/;

function peelOneIndianAmountFromEnd(s: string): { amount: string; rest: string } | null {
  const comma = s.match(INDIAN_COMMA_AMOUNT_AT_END);
  if (comma) {
    return { amount: comma[1]!, rest: s.slice(0, s.length - comma[1]!.length) };
  }

  // Kotak glues txn + balance (e.g. `500.0087.44` → 500.00 + 87.44).
  const gluedPair = s.match(/(\d{1,6}\.\d{2})(\d{1,3}\.\d{2})$/);
  if (gluedPair) {
    return {
      amount: gluedPair[2]!,
      rest: s.slice(0, s.length - gluedPair[2]!.length),
    };
  }

  const plain = s.match(PLAIN_AMOUNT_AT_END);
  if (!plain) return null;
  return { amount: plain[1]!, rest: s.slice(0, s.length - plain[1]!.length) };
}

function peelIndianAmountsFromEnd(s: string, count: number): string[] {
  const found: string[] = [];
  let rest = s;
  while (found.length < count && rest.length > 0) {
    const peeled = peelOneIndianAmountFromEnd(rest);
    if (!peeled) break;
    found.unshift(peeled.amount);
    rest = peeled.rest;
  }
  return found;
}

const INDIAN_COMMA_AMOUNT_AT_START =
  /^([1-9]\d{0,2}(?:,\d{2,3}){1,2}\.\d{2})/;
const PLAIN_AMOUNT_AT_START = /^(\d{1,6}\.\d{2})/;
const GLUED_TXN_BALANCE_AT_START = /^(\d{1,6}\.\d{2})(\d{1,3}\.\d{2})/;

/** Kotak glues txn then balance after the UPI ref: `{ref}{txn}{balance}`. */
function peelOneIndianAmountFromStart(
  s: string
): { amount: string; rest: string } | null {
  const comma = s.match(INDIAN_COMMA_AMOUNT_AT_START);
  if (comma) {
    return { amount: comma[1]!, rest: s.slice(comma[1]!.length) };
  }
  const glued = s.match(GLUED_TXN_BALANCE_AT_START);
  if (glued) {
    return { amount: glued[1]!, rest: s.slice(glued[1]!.length) };
  }
  const plain = s.match(PLAIN_AMOUNT_AT_START);
  if (!plain) return null;
  return { amount: plain[1]!, rest: s.slice(plain[1]!.length) };
}

function peelIndianAmountsFromStart(s: string, count: number): string[] {
  const found: string[] = [];
  let rest = s;
  while (found.length < count && rest.length > 0) {
    const peeled = peelOneIndianAmountFromStart(rest);
    if (!peeled) break;
    found.push(peeled.amount);
    rest = peeled.rest;
  }
  return found;
}

function amountsFromRefTail(
  numericPayload: string,
  refLen: number
): { txn: number; balance: number; amounts: string[] } | null {
  if (refLen >= numericPayload.length - 4) return null;
  const tail = numericPayload.slice(refLen);
  const forward = peelIndianAmountsFromStart(tail, 2);
  if (forward.length >= 2) {
    const txn = parseIndianAmount(forward[0]!);
    const balance = parseIndianAmount(forward[1]!);
    if (txn > 0 && txn <= 5_000_000 && balance > 0 && balance <= 50_000_000) {
      return { txn, balance, amounts: forward };
    }
  }
  const backward = peelIndianAmountsFromEnd(tail, 2);
  if (backward.length < 2) return null;
  const txn = parseIndianAmount(backward[0]!);
  const balance = parseIndianAmount(backward[1]!);
  if (txn <= 0 || txn > 5_000_000 || balance <= 0 || balance > 50_000_000) {
    return null;
  }
  return { txn, balance, amounts: backward };
}

/** PDF text often glues labels like `EndofStatement` directly after the balance. */
function stripLettersForAmountParse(s: string): string {
  return s.replace(/[A-Za-z/]+/g, "");
}

/** Last `UPI-` that starts a numeric bank reference (skips glossary lines like `UPI-Unified…`). */
function lastUpiReferenceIndex(compact: string): number {
  let last = -1;
  const re = /UPI-\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(compact)) !== null) {
    last = m.index;
  }
  return last;
}

function scoreFooterSplit(
  txn: number,
  balance: number,
  prevBalance: number | null
): number {
  let score = 0;
  if (prevBalance != null) {
    if (amountsRoughlyEqual(prevBalance + txn, balance)) score += 2_000_000;
    else if (amountsRoughlyEqual(prevBalance - txn, balance)) score += 2_000_000;
    else score -= 1_000_000;
  }
  return score;
}

/** Kotak 811 bill pay rows end with `811BP-{ref}{txn}{balance}` (no UPI-). */
function parseKotak811BillPayFooter(
  compact: string,
  prevBalance: number | null
): { txnAmount: number; balance: number; description: string } | null {
  // Ref is 12 digits; amount + balance are glued after it (e.g. `…811BP-2600115131845159.007015.86`).
  const m = compact.match(/^(.*?)811BP-(\d{12})([0-9,.]+)$/i);
  if (!m) return null;

  const description = m[1]!.trim();
  const tail = m[3]!;

  type Cand = { txn: number; balance: number; score: number };
  let bestBalanced: Cand | null = null;
  let bestOverall: Cand | null = null;

  const tryAmounts = (amounts: string[]) => {
    if (amounts.length < 2) return;
    const txn = parseIndianAmount(amounts[0]!);
    const balance = parseIndianAmount(amounts[1]!);
    if (txn <= 0 || txn > 5_000_000 || balance <= 0 || balance > 50_000_000) return;
    const balScore = scoreFooterSplit(txn, balance, prevBalance);
    const cand = { txn, balance, score: balScore };
    if (balScore >= 2_000_000 && (!bestBalanced || cand.score > bestBalanced.score)) {
      bestBalanced = cand;
    }
    if (!bestOverall || cand.score > bestOverall.score) {
      bestOverall = cand;
    }
  };

  tryAmounts(peelIndianAmountsFromStart(tail, 2));
  tryAmounts(peelIndianAmountsFromEnd(tail, 2));

  if (!bestBalanced && !bestOverall) return null;
  const pick = bestBalanced ?? bestOverall!;

  return {
    txnAmount: pick.txn,
    balance: pick.balance,
    description,
  };
}

/**
 * `CASHBACK EARNED ONBF-{hex}{txn}{balance}` — PDF often drops `|` and spaces, gluing
 * hash suffix to amount (e.g. `…a94.687,040.54` → hash `…a9` + ₹4.68 + ₹7,040.54).
 */
function parseKotakOnbfCashbackFooter(
  compact: string,
  prevBalance: number | null
): { txnAmount: number; balance: number; description: string } | null {
  const onbf = compact.match(/ONBF-/i);
  if (!onbf || onbf.index == null) return null;

  const after = compact.slice(onbf.index + 5).replace(/^\|/, "");
  type Cand = { txn: number; balance: number; balScore: number; hashLen: number };
  let best: Cand | null = null;

  for (let hashLen = 8; hashLen <= Math.min(32, after.length - 6); hashLen++) {
    const hash = after.slice(0, hashLen);
    if (!/^[a-f0-9]+$/i.test(hash)) continue;
    const tail = after.slice(hashLen);
    const forward = peelIndianAmountsFromStart(tail, 2);
    if (forward.length < 2) continue;
    const txn = parseIndianAmount(forward[0]!);
    const balance = parseIndianAmount(forward[1]!);
    if (txn <= 0 || txn > 100_000 || balance <= 0 || balance > 50_000_000) continue;
    const balScore = scoreFooterSplit(txn, balance, prevBalance);
    const cand = { txn, balance, balScore, hashLen };
    if (
      !best ||
      cand.balScore > best.balScore ||
      (cand.balScore === best.balScore && cand.hashLen > best.hashLen)
    ) {
      best = cand;
    }
  }

  if (!best || best.balScore < 2_000_000) return null;

  const hash = after.slice(0, best.hashLen);
  const description = `${compact.slice(0, onbf.index)}ONBF-${hash}`.trim();

  return {
    txnAmount: best.txn,
    balance: best.balance,
    description: description || "CASHBACK EARNED",
  };
}

/** Cashback lines: `CASHBACK EARNEDONBF-|hash|{txn}{balance}` (no UPI-). */
function parseKotakCashbackFooter(
  compact: string,
  prevBalance: number | null
): { txnAmount: number; balance: number; description: string } | null {
  if (!/CASHBACK/i.test(compact)) return null;

  const onbf = parseKotakOnbfCashbackFooter(compact, prevBalance);
  if (onbf) return onbf;

  const numericTail = stripLettersForAmountParse(compact);
  type Cand = { txn: number; balance: number; score: number; peelFrom: number };
  let bestBalanced: Cand | null = null;
  let bestOverall: Cand | null = null;

  for (let peelFrom = 0; peelFrom < Math.min(numericTail.length, 48); peelFrom++) {
    const amounts = peelIndianAmountsFromEnd(numericTail.slice(peelFrom), 2);
    if (amounts.length < 2) continue;
    const txn = parseIndianAmount(amounts[0]!);
    const balance = parseIndianAmount(amounts[1]!);
    if (txn <= 0 || txn > 100_000 || balance <= 0 || balance > 50_000_000) continue;
    const balScore = scoreFooterSplit(txn, balance, prevBalance);
    const cand = { txn, balance, score: balScore + peelFrom, peelFrom };
    if (balScore >= 2_000_000 && (!bestBalanced || cand.score > bestBalanced.score)) {
      bestBalanced = cand;
    }
    if (!bestOverall || cand.score > bestOverall.score) {
      bestOverall = cand;
    }
  }

  const pick = bestBalanced ?? bestOverall;
  if (!pick) return null;

  const amounts = peelIndianAmountsFromEnd(numericTail.slice(pick.peelFrom), 2);
  const txnStr = amounts[0] ?? String(pick.txn);
  const balStr = amounts[1] ?? String(pick.balance);

  let description = compact;
  const gluedEnd = compact.match(/(\d{1,6}\.\d{2})(\d{1,3}(?:,\d{2,3})*\.\d{2})$/);
  if (gluedEnd) {
    description = compact.slice(0, compact.length - gluedEnd[0]!.length).trim();
  } else {
    const balIdx = compact.lastIndexOf(balStr);
    if (balIdx > 0) {
      description = compact.slice(0, balIdx).replace(/[\d,]+$/, "").trim();
    }
  }

  return {
    txnAmount: pick.txn,
    balance: pick.balance,
    description: description || compact,
  };
}

/** Kotak PDFs glue UPI refs to amounts (e.g. `UPI-5152148804642,000.002,483.03`). */
function parseKotakFooter(
  compact: string,
  prevBalance: number | null
): { txnAmount: number; balance: number; description: string } | null {
  const bill811 = parseKotak811BillPayFooter(compact, prevBalance);
  if (bill811) return bill811;

  const cashback = parseKotakCashbackFooter(compact, prevBalance);
  if (cashback) return cashback;

  if (
    !/UPI-|811BP|811:|NEFT-|IMPS-|Int\.Pd|CASHBACK|BBPS|KOTAK|FD\s*BOOKED|RD\s*BOOKED|SWEEP|CCBILL|BILL\s*PAID|AUTOFUND/i.test(
      compact
    )
  ) {
    return null;
  }

  const pickBestSplit = (
    payload: string,
    descriptionEnd: number
  ): { txnAmount: number; balance: number; description: string } | null => {
    type Cand = { amounts: string[]; score: number; txn: number; balance: number };
    let bestBalanced: Cand | null = null;
    let bestOverall: Cand | null = null;
    const numericPayload = stripLettersForAmountParse(payload.slice(0, 72));
    const refLens = [
      12, 11, 13, 10, 14, 15, 16, 9, 8,
      ...Array.from({ length: numericPayload.length }, (_, i) => i + 1),
    ];
    const seen = new Set<number>();
    for (const refLen of refLens) {
      if (seen.has(refLen)) continue;
      seen.add(refLen);
      const parsed = amountsFromRefTail(numericPayload, refLen);
      if (!parsed) continue;
      const { txn, balance, amounts } = parsed;
      const balScore = scoreFooterSplit(txn, balance, prevBalance);
      const score = balScore + (refLen === 12 ? 50_000 : 0) + refLen;
      const cand = { amounts, score, txn, balance };
      if (balScore >= 2_000_000 && (!bestBalanced || score > bestBalanced.score)) {
        bestBalanced = cand;
      }
      if (!bestOverall || score > bestOverall.score) {
        bestOverall = cand;
      }
    }
    let ref12Cand: Cand | null = null;
    const ref12Parsed = amountsFromRefTail(numericPayload, 12);
    if (ref12Parsed) {
      const balScore = scoreFooterSplit(
        ref12Parsed.txn,
        ref12Parsed.balance,
        prevBalance
      );
      ref12Cand = {
        amounts: ref12Parsed.amounts,
        score: balScore + 50_000,
        txn: ref12Parsed.txn,
        balance: ref12Parsed.balance,
      };
    }
    const ref12Balanced =
      ref12Cand &&
      scoreFooterSplit(ref12Cand.txn, ref12Cand.balance, prevBalance) >= 2_000_000;
    const pick =
      bestBalanced ??
      (ref12Balanced ? ref12Cand : null) ??
      (ref12Cand && ref12Cand.txn <= 200_000 ? ref12Cand : null) ??
      (prevBalance == null && bestOverall && bestOverall.txn <= 200_000
        ? bestOverall
        : null);
    if (!pick) return null;
    return {
      txnAmount: pick.txn,
      balance: pick.balance,
      description: compact.slice(0, descriptionEnd).trim(),
    };
  };

  const upiIdx = lastUpiReferenceIndex(compact);
  if (upiIdx >= 0) {
    const payload = compact.slice(upiIdx + 4);
    const parsed = pickBestSplit(payload, upiIdx);
    if (parsed) return parsed;
  }

  const numericTail = stripLettersForAmountParse(compact);
  type Cand = { amounts: string[]; score: number; txn: number; balance: number };
  let bestBalanced: Cand | null = null;
  let bestOverall: Cand | null = null;
  for (let peelFrom = 0; peelFrom < Math.min(numericTail.length, 80); peelFrom++) {
    const amounts = peelIndianAmountsFromEnd(numericTail.slice(peelFrom), 2);
    if (amounts.length < 2) continue;
    const txn = parseIndianAmount(amounts[0]!);
    const balance = parseIndianAmount(amounts[1]!);
    if (txn <= 0 || txn > 5_000_000 || balance > 50_000_000) continue;
    const balScore = scoreFooterSplit(txn, balance, prevBalance);
    const score = balScore + peelFrom;
    const cand = { amounts, score, txn, balance };
    if (balScore >= 2_000_000 && (!bestBalanced || score > bestBalanced.score)) {
      bestBalanced = cand;
    }
    if (!bestOverall || score > bestOverall.score) {
      bestOverall = cand;
    }
  }
  const pick =
    bestBalanced ??
    (bestOverall && bestOverall.txn <= 200_000 ? bestOverall : null);
  if (!pick) return null;

  const [txnStr, balanceStr] = pick.amounts;
  const description = compact
    .slice(0, compact.length - balanceStr.length - txnStr.length)
    .trim();
  return { txnAmount: pick.txn, balance: pick.balance, description };
}

function inferTypeFromDescription(desc: string): "income" | "expense" | null {
  const u = desc.toUpperCase();
  if (u.includes("CASHBACK")) {
    return "income";
  }
  if (
    u.includes("INT.PD") ||
    u.includes("REFUND") ||
    u.includes("REV-UPI") ||
    u.includes("REV UPI")
  ) {
    return "income";
  }
  return null;
}

function inferTypeFromBalances(
  prevBalance: number | null,
  txnAmount: number,
  newBalance: number
): "income" | "expense" {
  if (prevBalance != null) {
    if (amountsRoughlyEqual(prevBalance + txnAmount, newBalance)) return "income";
    if (amountsRoughlyEqual(prevBalance - txnAmount, newBalance)) return "expense";
  }
  return "expense";
}

/** Kotak rows are glued as `{serial}{DD Mon YYYY}UPI/...` e.g. `5425 May 2026UPI`. */
const TX_AFTER_DATE =
  "UPI/|UPI-|NEFT|IMPS|INF|INFT|ATM|MB|Int\\.|CASHBACK|FD\\s|RD\\s|REV-|KOTAK|SWEEP|ACH-|MB\\s|811:|BILL|CCBILL|AUTOFUND|Amazon|CREDIT|Received|PAID\\s+TO|Razorpa|Razorpay";

const TX_ROW = new RegExp(
  `(\\d{1,3}?)(\\d{1,2} (?:${MONTHS}) \\d{4})(?=${TX_AFTER_DATE})`,
  "gi"
);

/** Insert line breaks only before real row headers (not inside cashback amount glue). */
function breakGluedKotakRows(text: string): string {
  const rowHead =
    "(?:UPI|811|CASHBACK|NEFT|REV|BILL|MB|KOTAK|FD|RD|AUTOFUND|Int\\.|SWEEP|ACH)";
  return text.replace(
    new RegExp(
      `(\\d[\\d,]{0,14}\\.\\d{2})(?=(\\d{2,3})(\\d{2} (?:${MONTHS}) \\d{4})(?=${rowHead}))`,
      "g"
    ),
    "$1\n"
  );
}

/** Row may start on a new line or immediately after a statement balance amount. */
function kotakRowStartAllowed(text: string, index: number): boolean {
  if (index === 0) return true;
  if (text[index - 1] === "\n") return true;
  const compact = text.slice(Math.max(0, index - 28), index).replace(/\s/g, "");
  if (/(?:\d{1,3}(?:,\d{2,3})*\.\d{2}|\d{1,6}\.\d{2})$/.test(compact)) {
    return true;
  }
  // Balance glued to serial+day (e.g. `…035.861607` before ` May 2026`).
  if (/\.\d{2}\d{2,3}$/.test(compact)) return true;
  return false;
}

export function normalizeKotakPdfText(text: string): string {
  return breakGluedKotakRows(
    text
      .replace(/\r/g, "")
      .replace(/Statement Generated on[\s\S]*?Page \d+ of \d+/gi, "\n")
      .replace(/Account Statement\d{2} \w+ \d{4}[\s\S]*?Page \d+ of \d+/gi, "\n")
  );
}

export function findKotakTransactionStarts(text: string): { index: number; dateStr: string }[] {
  const starts: { index: number; dateStr: string }[] = [];
  const opening = text.match(/--Opening Balance---[\d,]+\.\d{2}/);
  const searchFrom = opening ? opening.index! + opening[0].length : 0;

  let prevSerial = 0;
  let m: RegExpExecArray | null;
  TX_ROW.lastIndex = searchFrom;
  while ((m = TX_ROW.exec(text)) !== null) {
    const index = m.index;
    const split = splitSerialDateFromGlued(text.slice(index, index + 24), prevSerial);
    if (!split) continue;
    const { serial, dateStr } = split;

    if (!kotakRowStartAllowed(text, index)) continue;

    prevSerial = parseInt(serial, 10);
    starts.push({ index, dateStr });
  }
  starts.sort((a, b) => a.index - b.index);
  return starts;
}

export function parseKotakStatement(text: string): {
  lines: ParsedStatementLine[];
  opening_balance: number | null;
  closing_balance: number | null;
} {
  const normalized = normalizeKotakPdfText(text);

  const opening = normalized.match(/--Opening Balance---([\d,]+\.\d{2})/);
  const opening_balance = opening ? parseIndianAmount(opening[1]!) : null;
  let prevBalance = opening_balance;

  const starts = findKotakTransactionStarts(normalized);
  const out: ParsedStatementLine[] = [];

  const ROW_HEAD = new RegExp(`^(\\d{1,3}?)(\\d{1,2} (?:${MONTHS}) \\d{4})`);

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const end = i + 1 < starts.length ? starts[i + 1]!.index : normalized.length;
    const chunk = normalized.slice(start.index, end);
    const lines = chunk
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !JUNK_LINE.test(l) && !/^--Opening Balance/.test(l));
    if (lines.length === 0) continue;

    const block = lines.join(" ");
    const rowMatch = block.match(ROW_HEAD);
    if (!rowMatch) continue;
    const body = block.slice(rowMatch[0].length);
    const compact = body.replace(/\s+/g, "");
    const footer = parseKotakFooter(compact, prevBalance);
    if (!footer) continue;

    const { txnAmount, balance, description } = footer;

    const hinted = inferTypeFromDescription(description);
    const type =
      hinted ??
      inferTypeFromBalances(prevBalance, txnAmount, balance);

    prevBalance = balance;

    const { name, reference_no } = extractKotakTransactionDetails(description);

    out.push({
      statement_order: i,
      occurred_at: resolveOccurredAt(start.dateStr, description),
      name,
      reference_no,
      type,
      amount: txnAmount,
      note: null,
    });
  }

  return { lines: out, opening_balance, closing_balance: prevBalance };
}
