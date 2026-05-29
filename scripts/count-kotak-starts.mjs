import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const path =
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));

const kotak = await import("../src/services/statementImport/kotakParser.ts");
const { parseKotakStatement, normalizeKotakPdfText, findKotakTransactionStarts } =
  kotak;

const norm = normalizeKotakPdfText(text);
const i = norm.indexOf("f516a1a15c689a9");
const snippet = norm.slice(i - 50, i + 60).replace(/\n/g, "|");
console.log("normalized snippet:", snippet);
const sub = norm.slice(i - 30, i + 80);
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const GLUED = new RegExp(
  `(\\d[\\d,]{0,14}\\.\\d{2})(?=(\\d{2,3})(\\d{2} (?:${MONTHS}) \\d{4}))`,
  "g"
);
console.log("re-break:", sub.replace(GLUED, "$1\n").replace(/\n/g, "|"));

const starts = findKotakTransactionStarts(text);
const i1607 = norm.indexOf("1607 May 2026CASHBACK EARNED");
const compact = norm.slice(Math.max(0, i1607 - 28), i1607).replace(/\s/g, "");
console.log(
  "May7 CASHBACK idx",
  i1607,
  "glued allowed",
  /\.\d{2}\d{2,3}$/.test(compact),
  "compact tail",
  compact.slice(-16)
);
const earnedStart = starts.find((s, idx) => {
  const next = starts[idx + 1]?.index ?? norm.length;
  const block = norm.slice(s.index, Math.min(s.index + 80, next));
  return block.includes("CASHBACK EARNED") && block.includes("f516a1a15c689a9");
});
console.log("starts", starts.length, "May7 CASHBACK EARNED start", earnedStart);

const r = parseKotakStatement(text);
const may7 = r.lines.filter((l) => l.occurred_at === "2026-05-07");
console.log(
  "May 7:",
  may7.map((l) => `${l.type} ${l.amount} ${l.name}`)
);
const earned = r.lines.filter((l) =>
  (l.reference_no ?? "").toUpperCase().includes("CASHBACK EARNED")
);
console.log("CASHBACK EARNED rows:", earned.length, earned);
