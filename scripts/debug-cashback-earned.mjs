import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const {
  normalizeKotakPdfText,
  findKotakTransactionStarts,
} = require("../src/services/statementImport/kotakParser.ts");
const { parseKotakStatement } = require("../src/services/statementImport/kotakParser.ts");
const { parseIndianAmount, amountsRoughlyEqual } = require("../src/services/statementImport/amountUtils.ts");

const path =
  process.argv[2] ??
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));
const norm = normalizeKotakPdfText(text);
const starts = findKotakTransactionStarts(text);
const i = starts.findIndex((s, idx) => {
  const next = starts[idx + 1]?.index ?? norm.length;
  return norm.slice(s.index, next).includes("f516a1a15c689a9");
});
const start = starts[i];
const end = starts[i + 1]?.index ?? norm.length;
const chunk = norm.slice(start.index, end);
const body = chunk.replace(/^\d+?\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}/, "");
const compact = body.replace(/\s+/g, "");
console.log("chunk", chunk.slice(0, 120));
console.log("compact", compact);

const result = parseKotakStatement(text);
const earned = result.lines.filter((l) => /cashback/i.test(l.name) && l.occurred_at === "2026-05-07");
console.log("May 7 cashback lines", earned);
console.log("total", result.lines.length, "closing", result.closing_balance);
