import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const {
  normalizeKotakPdfText,
  findKotakTransactionStarts,
  parseKotakStatement,
} = require("../src/services/statementImport/kotakParser.ts");

const path =
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));
const norm = normalizeKotakPdfText(text);
const starts = findKotakTransactionStarts(text);
const opening = norm.match(/--Opening Balance---([\d,]+\.\d{2})/);
const { parseIndianAmount } = require("../src/services/statementImport/amountUtils.ts");
let prev = opening ? parseIndianAmount(opening[1]) : null;

const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const ROW_HEAD = new RegExp(`^(\\d{1,3}?)(\\d{1,2} (?:${MONTHS}) \\d{4})`);

// dynamic import parseKotakFooter - not exported; duplicate call via eval
const kotak = await import("../src/services/statementImport/kotakParser.ts");

for (let i = 0; i < starts.length; i++) {
  const start = starts[i];
  const end = starts[i + 1]?.index ?? norm.length;
  const chunk = norm.slice(start.index, end);
  const block = chunk.replace(/\n/g, " ").trim();
  const rowMatch = block.match(ROW_HEAD);
  if (!rowMatch) continue;
  const body = block.slice(rowMatch[0].length);
  const compact = body.replace(/\s+/g, "");
  const footer = kotak.parseKotakStatement ? null : null;
}

// Use re-parse by importing module and testing compact directly via statement
const result = parseKotakStatement(text);
for (const l of result.lines) {
  if (l.occurred_at.startsWith("2026-05-07")) {
    console.log(l);
  }
}

const idx = starts.findIndex((s, i) => {
  const next = starts[i + 1]?.index ?? norm.length;
  return norm.slice(s.index, next).includes("f516a1a15c689a9");
});
console.log("f516 start idx", idx, "of", starts.length);
