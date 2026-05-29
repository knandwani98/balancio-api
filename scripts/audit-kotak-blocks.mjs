import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const { parseIndianAmount, amountsRoughlyEqual } = require("../src/services/statementImport/amountUtils.ts");

const path =
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));
const norm = text
  .replace(/\r/g, "")
  .replace(/Statement Generated on[\s\S]*?Page \d+ of \d+/gi, "\n")
  .replace(/Account Statement\d{2} \w+ \d{4}[\s\S]*?Page \d+ of \d+/gi, "\n");

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const TX_ROW = new RegExp(
  `(\\d{1,3}?)(\\d{1,2} (?:${MONTHS}) \\d{4})(?=UPI/|UPI-|NEFT|IMPS|INF|INFT|ATM|MB|Int\\.|CASHBACK|FD\\s|RD\\s|REV-|KOTAK|SWEEP|ACH-|MB\\s|811:)`,
  "gi"
);
const opening = norm.match(/--Opening Balance---([\d,]+\.\d{2})/);
const searchFrom = opening ? opening.index + opening[0].length : 0;
const starts = [];
TX_ROW.lastIndex = searchFrom;
let m;
while ((m = TX_ROW.exec(norm)) !== null) {
  const dateStr = m[2];
  const day = Number(dateStr.match(/^(\d{1,2})/)?.[1]);
  if (day < 1 || day > 31) continue;
  const prefix = norm.slice(Math.max(0, m.index - 8), m.index);
  if (/\d\.\d{2}\d{1,3}$/.test(prefix)) continue;
  starts.push({ index: m.index, dateStr, snippet: norm.slice(m.index, m.index + 100).replace(/\n/g, "|") });
}

for (const needle of ["BILL PAID", "5582756555", "4117May", "CCBILL"]) {
  const i = norm.indexOf(needle);
  if (i >= 0)
    console.log(needle, norm.slice(i - 40, i + 100).replace(/\n/g, "|"));
}

console.log("starts count", starts.length);
const may17 = starts.filter((s) => s.dateStr.includes("17 May"));
console.log("17 May starts:", may17.length, may17.map((s) => s.snippet.slice(0, 60)));

console.log("starts count", starts.length);
for (const idx of [0, 1, 2, 3, 4]) {
  const s = starts[idx];
  const end = starts[idx + 1]?.index ?? norm.length;
  console.log(`\n=== block ${idx + 1} ${s.dateStr} ===`);
  console.log(s.snippet);
  console.log(norm.slice(s.index, Math.min(end, s.index + 250)).replace(/\n/g, "|"));
}
