import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const { parseKotakStatement } = require("../src/services/statementImport/kotakParser.ts");

const path =
  process.argv[2] ??
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const { text } = await pdf(fs.readFileSync(path));
const norm = text.replace(/\r/g, "");

for (const needle of [
  "811:BBPS",
  "UPPCL",
  "CASHBACK EARNED",
  "CASHBACK FOR BILLPAY",
  "811BP-",
]) {
  const i = norm.indexOf(needle);
  if (i < 0) {
    console.log("NOT FOUND", needle);
    continue;
  }
  console.log("\n===", needle, "===");
  console.log(norm.slice(i - 30, i + 120).replace(/\n/g, "|"));
}

const result = parseKotakStatement(text);
console.log("\nParsed", result.lines.length);
for (const l of result.lines) {
  if (/cashback|bbps|uppcl|811/i.test(l.name + l.reference_no)) {
    console.log(l.statement_order, l.occurred_at, l.type, l.amount, l.name);
  }
}
