import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const { parseKotakStatement } = require("../src/services/statementImport/kotakParser.ts");

const path =
  process.argv[2] ??
  "/Users/kushalnandwani/Downloads/AccountStatement_01-May-2026_27-May-2026.pdf";
const buf = fs.readFileSync(path);
const { text } = await pdf(buf);
const result = parseKotakStatement(text);

console.log("first line:", result.lines[0]);
console.log("total lines", result.lines.length);
console.log("closing balance", result.closing_balance);

const may25 = result.lines.filter((l) => l.occurred_at === "2026-05-25");
console.log("May 25:", may25);
