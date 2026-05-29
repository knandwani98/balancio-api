import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const { parseKotakStatement } = require("../src/services/statementImport/kotakParser.ts");
const { parseIndianAmount, amountsRoughlyEqual } = require("../src/services/statementImport/amountUtils.ts");

const path =
  process.argv[2] ??
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));
const norm = text.replace(/\r/g, "");
const opening = norm.match(/--Opening Balance---([\d,]+\.\d{2})/);
let prev = opening ? parseIndianAmount(opening[1]) : null;

const result = parseKotakStatement(text);
console.log("total", result.lines.length, "closing", result.closing_balance);

const mismatches = [];
for (let i = 0; i < result.lines.length; i++) {
  const l = result.lines[i];
  const nextBal =
    l.type === "income" ? (prev ?? 0) + l.amount : (prev ?? 0) - l.amount;
  const ok =
    prev == null ||
    (i < result.lines.length - 1
      ? true
      : amountsRoughlyEqual(nextBal, result.closing_balance ?? nextBal));
  if (prev != null && i === result.lines.length - 1 && !amountsRoughlyEqual(nextBal, result.closing_balance ?? 0)) {
    mismatches.push({ i: i + 1, ...l, prev, expectedClose: nextBal });
  }
  if (prev != null && i < result.lines.length - 1) {
    // intermediate balance not stored — flag suspicious tiny/huge
    if (l.amount < 10 && !/cashback/i.test(l.name)) {
      mismatches.push({ i: i + 1, reason: "tiny", ...l, prev });
    }
    if (l.amount > 100000) {
      mismatches.push({ i: i + 1, reason: "huge", ...l, prev });
    }
  }
  prev = nextBal;
}

console.log("\nFlags:", mismatches.length ? mismatches : "none");
for (const m of mismatches) console.log(m);

console.log("\nAll lines:");
for (let i = 0; i < result.lines.length; i++) {
  const l = result.lines[i];
  console.log(
    `${String(i + 1).padStart(2)} ${l.occurred_at} ${String(l.amount).padStart(10)} ${l.type.padEnd(7)} ${l.name.slice(0, 55)}`
  );
}
