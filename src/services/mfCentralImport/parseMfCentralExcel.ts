import ExcelJS from "exceljs";
import { inferFundMeta } from "./inferFundMeta.js";

export type ParsedMfCentralOrder = {
  scheme_name: string;
  description: string;
  txn_date: string;
  nav: number;
  units: number;
  amount: number;
};

export type ParsedMfCentralFund = {
  name: string;
  amc_name: string | null;
  category: string | null;
  folio: string | null;
  invested: number;
  current_value: number;
  units: number;
  returns: number;
  fund_type: string;
  asset_type: string;
  orders: ParsedMfCentralOrder[];
};

export type ParsedMfCentralStatement = {
  from_date: string | null;
  to_date: string | null;
  funds: ParsedMfCentralFund[];
};

const HOLDING_NAME_MAX = 250;

const SKIP_NAME_RE =
  /^(total|grand total|sub total|subtotal|opening|closing|particulars|description|scheme|fund name|isin|total investments|current portfolio value)$/i;

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("text" in value && value.text != null) return String(value.text).trim();
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("hyperlink" in value && "text" in value) return String(value.text ?? "").trim();
  }
  return String(value).trim();
}

function cellToNumber(value: ExcelJS.CellValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value && "result" in value) {
    return cellToNumber(value.result as ExcelJS.CellValue);
  }
  const text = cellToString(value).replace(/,/g, "").replace(/\((.+)\)/, "-$1");
  if (!text) return 0;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function schemeHeaderScore(normalized: string): number {
  if (!normalized) return 0;
  if (/(code|type|id|category|option)$/.test(normalized) && !normalized.includes("name")) {
    return 0;
  }
  if (normalized === "schemename" || normalized === "fundname") return 6;
  if (normalized.includes("schemename") || normalized.includes("fundname")) return 4;
  if (normalized === "scheme" || normalized === "fund") return 3;
  return 0;
}

function isSkippableName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 4) return true;
  if (SKIP_NAME_RE.test(trimmed)) return true;
  if (/^in[a-z0-9]{9,12}$/i.test(trimmed)) return true;
  if (/^\d+([.,]\d+)?$/.test(trimmed)) return true;
  return false;
}

function clipName(name: string) {
  const collapsed = name.trim().replace(/\s+/g, " ");
  if (collapsed.length <= HOLDING_NAME_MAX) return collapsed;
  return collapsed.slice(0, HOLDING_NAME_MAX).trim();
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function toIsoDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const mon = t.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{4})$/);
  if (mon) {
    const month = MONTHS[mon[2]!.toLowerCase()];
    if (!month) return null;
    return `${mon[3]}-${month}-${mon[1]!.padStart(2, "0")}`;
  }
  const num = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (num) {
    return `${num[3]}-${num[2]!.padStart(2, "0")}-${num[1]!.padStart(2, "0")}`;
  }
  return null;
}

function assetTypeFromCategory(category: string | null): string | null {
  if (!category) return null;
  const c = category.trim().toLowerCase();
  if (c === "equity" || c === "equity fund") return "equity";
  if (c === "debt") return "debt";
  if (c === "hybrid") return "hybrid";
  return null;
}

function classifyFund(name: string, category: string | null) {
  const inferred = inferFundMeta(name);
  const cat = category?.trim().toLowerCase() ?? "";
  let fundType = inferred.fund_type;
  let assetType = inferred.asset_type;
  if ((cat === "fof" || cat === "fund of funds") && fundType === "other") {
    fundType = "fof";
  }
  const fromCat = assetTypeFromCategory(category);
  if (assetType === "equity" && fromCat && fromCat !== "equity") {
    assetType = fromCat;
  }
  return { fund_type: fundType, asset_type: assetType };
}

type ColumnMap = {
  headerRow: number;
  scheme: number;
  amc: number;
  category: number;
  folio: number;
  invested: number;
  current: number;
  returns: number;
  units: number;
};

function findColumns(row: ExcelJS.Row): Omit<ColumnMap, "headerRow"> | null {
  let scheme = 0;
  let schemeScore = 0;
  let amc = 0;
  let category = 0;
  let folio = 0;
  let invested = 0;
  let current = 0;
  let returns = 0;
  let units = 0;

  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = normalizeHeader(cellToString(cell.value));
    const s = schemeHeaderScore(key);
    if (s > schemeScore) {
      schemeScore = s;
      scheme = col;
    }
    if (key === "amcname" || key === "amc" || key === "fundhouse") amc = col;
    if (key === "category") category = col;
    if (key === "foliono" || key === "folio" || key === "folionumber") folio = col;
    if (key === "investedvalue" || key === "invested" || key === "costvalue") invested = col;
    if (key === "currentvalue" || key === "marketvalue" || key === "valuation") current = col;
    if (key === "returns" || key === "profitloss") returns = col;
    if (key === "units" || key === "unit" || key === "closingunits") units = col;
  });

  if (!scheme || schemeScore < 3) return null;
  return { scheme, amc, category, folio, invested, current, returns, units };
}

function readMeta(sheet: ExcelJS.Worksheet) {
  let fromDate: string | null = null;
  let toDate: string | null = null;
  const scanTo = Math.min(sheet.rowCount, 15);
  for (let r = 1; r <= scanTo; r++) {
    const row = sheet.getRow(r);
    const label = normalizeHeader(cellToString(row.getCell(1).value));
    const value = cellToString(row.getCell(2).value) || null;
    if (label === "fromdate") fromDate = value;
    if (label === "todate") toDate = value;
  }
  return { fromDate, toDate };
}

function parsePortfolioSheet(sheet: ExcelJS.Worksheet): ParsedMfCentralFund[] {
  const rowCount = sheet.rowCount;
  const scanTo = Math.min(rowCount, 40);
  let columns: ColumnMap | null = null;

  for (let r = 1; r <= scanTo; r++) {
    const found = findColumns(sheet.getRow(r));
    if (found) {
      columns = { headerRow: r, ...found };
      break;
    }
  }

  if (!columns) return [];

  const funds: ParsedMfCentralFund[] = [];
  const seen = new Set<string>();

  for (let r = columns.headerRow + 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const rawName = cellToString(row.getCell(columns.scheme).value);
    if (!rawName || isSkippableName(rawName)) continue;
    const name = clipName(rawName);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const category = columns.category
      ? cellToString(row.getCell(columns.category).value) || null
      : null;
    const meta = classifyFund(name, category);
    funds.push({
      name,
      amc_name: columns.amc ? cellToString(row.getCell(columns.amc).value) || null : null,
      category,
      folio: columns.folio ? cellToString(row.getCell(columns.folio).value) || null : null,
      invested: columns.invested ? cellToNumber(row.getCell(columns.invested).value) : 0,
      current_value: columns.current ? cellToNumber(row.getCell(columns.current).value) : 0,
      units: columns.units ? cellToNumber(row.getCell(columns.units).value) : 0,
      returns: columns.returns ? cellToNumber(row.getCell(columns.returns).value) : 0,
      fund_type: meta.fund_type,
      asset_type: meta.asset_type,
      orders: [],
    });
  }

  return funds;
}

type TxnColumnMap = {
  headerRow: number;
  scheme: number;
  description: number;
  date: number;
  nav: number;
  units: number;
  amount: number;
};

function findTxnColumns(row: ExcelJS.Row): Omit<TxnColumnMap, "headerRow"> | null {
  let scheme = 0;
  let schemeScore = 0;
  let description = 0;
  let date = 0;
  let nav = 0;
  let units = 0;
  let amount = 0;

  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const key = normalizeHeader(cellToString(cell.value));
    const s = schemeHeaderScore(key);
    if (s > schemeScore) {
      schemeScore = s;
      scheme = col;
    }
    if (key === "transactiondescription" || key === "description" || key === "particulars") {
      description = col;
    }
    if (key === "date" || key === "transactiondate" || key === "txndate") date = col;
    if (key === "nav" || key === "price") nav = col;
    if (key === "units" || key === "unit") units = col;
    if (key === "amount" || key === "value") amount = col;
  });

  if (!scheme || schemeScore < 3 || !date || !nav || !units || !amount) return null;
  return { scheme, description, date, nav, units, amount };
}

function isRedemptionDescription(description: string) {
  return /^(redemption|redeem|sell|switch[\s-]?out)/i.test(description.trim());
}

function signedOrderValues(description: string, units: number, amount: number) {
  if (isRedemptionDescription(description) && units > 0) {
    return {
      units: -Math.abs(units),
      amount: amount > 0 ? -Math.abs(amount) : amount,
    };
  }
  return { units, amount };
}

function parseTransactionSheet(sheet: ExcelJS.Worksheet): ParsedMfCentralOrder[] {
  const rowCount = sheet.rowCount;
  const scanTo = Math.min(rowCount, 40);
  let columns: TxnColumnMap | null = null;

  for (let r = 1; r <= scanTo; r++) {
    const found = findTxnColumns(sheet.getRow(r));
    if (found) {
      columns = { headerRow: r, ...found };
      break;
    }
  }

  if (!columns) return [];

  const orders: ParsedMfCentralOrder[] = [];
  for (let r = columns.headerRow + 1; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    const rawName = cellToString(row.getCell(columns.scheme).value);
    if (!rawName || isSkippableName(rawName)) continue;
    const dateRaw = cellToString(row.getCell(columns.date).value);
    const txnDate = toIsoDate(dateRaw);
    const nav = cellToNumber(row.getCell(columns.nav).value);
    const description = columns.description
      ? cellToString(row.getCell(columns.description).value)
      : "";
    const signed = signedOrderValues(
      description,
      cellToNumber(row.getCell(columns.units).value),
      cellToNumber(row.getCell(columns.amount).value)
    );
    if (!txnDate || !(nav > 0) || signed.units === 0 || signed.amount === 0) continue;
    orders.push({
      scheme_name: clipName(rawName),
      description,
      txn_date: txnDate,
      nav,
      units: signed.units,
      amount: signed.amount,
    });
  }

  return orders;
}

function attachOrders(
  funds: ParsedMfCentralFund[],
  orders: ParsedMfCentralOrder[]
): ParsedMfCentralFund[] {
  const byName = new Map<string, ParsedMfCentralOrder[]>();
  for (const order of orders) {
    const key = order.scheme_name.toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(order);
    byName.set(key, list);
  }
  return funds.map((fund) => ({
    ...fund,
    orders: byName.get(fund.name.toLowerCase()) ?? [],
  }));
}

export async function parseMfCentralExcel(buffer: Buffer): Promise<ParsedMfCentralStatement> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new Error("Could not read Excel file. Upload the Detailed statement from MF Central.");
  }

  const portfolio =
    workbook.worksheets.find((sheet) => /portfolio/i.test(sheet.name)) ?? null;
  const transactionsSheet =
    workbook.worksheets.find((sheet) => /transaction/i.test(sheet.name)) ?? null;
  const fallbackSheets = portfolio ? [portfolio] : workbook.worksheets;

  let funds: ParsedMfCentralFund[] = [];
  let fromDate: string | null = null;
  let toDate: string | null = null;

  for (const sheet of fallbackSheets) {
    const meta = readMeta(sheet);
    if (meta.fromDate) fromDate = meta.fromDate;
    if (meta.toDate) toDate = meta.toDate;
    const parsed = parsePortfolioSheet(sheet);
    if (parsed.length > funds.length) funds = parsed;
  }

  if (funds.length === 0) {
    throw new Error(
      "No funds found in this file. Upload the Detailed Excel from MF Central (Portfolio Details sheet)."
    );
  }

  const txnSheets = transactionsSheet
    ? [transactionsSheet]
    : workbook.worksheets.filter((sheet) => sheet !== portfolio);
  let orders: ParsedMfCentralOrder[] = [];
  for (const sheet of txnSheets) {
    const parsed = parseTransactionSheet(sheet);
    if (parsed.length > orders.length) orders = parsed;
  }

  return {
    from_date: fromDate,
    to_date: toDate,
    funds: attachOrders(funds, orders),
  };
}
