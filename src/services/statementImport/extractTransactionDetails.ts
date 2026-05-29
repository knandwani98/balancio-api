const MAX_NAME_LEN = 120;
const MAX_REFERENCE_LEN = 500;

const GENERIC_PATH_PARTS = new Set([
  "UPI",
  "CR",
  "DR",
  "MB",
  "INF",
  "INFT",
  "API",
  "BILL",
  "UPIUPI",
  "PAYMENT",
  "PAYVIA",
  "SENTUSING",
  "SENTUSINGPAYT",
  "PAYVIARAZORPA",
  "PAYVIARAZORPAY",
  "UPITRANSACTION",
  "UPITRANSACTION",
]);

/** Strip amount glue and bank UPI footer refs from Kotak description tail. */
export function stripKotakDescriptionTail(raw: string): string {
  return raw
    .replace(/UPI-\d+$/i, "")
    .replace(/(\d{1,6}\.\d{2})(\d{1,3}\.\d{2})$/g, "")
    .replace(/(\d{1,3}(?:,\d{2,3})*\.\d{2}|\d+\.\d{2})+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Readable full description for the reference column. */
export function formatStatementDescription(
  stripped: string,
  bankRef: string | null
): string {
  let text = stripped
    .replace(/\//g, " / ")
    .replace(/\s+/g, " ")
    .trim();
  if (bankRef && !text.includes(bankRef)) {
    text = text ? `${text} (UPI Ref ${bankRef})` : `UPI Ref ${bankRef}`;
  }
  return text.slice(0, MAX_REFERENCE_LEN);
}

function splitCamelOrCaps(word: string): string {
  if (!word || /\s/.test(word)) return word;
  let s = word.replace(/([a-z\d])([A-Z])/g, "$1 $2");
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  if (/^[A-Z]{4,}$/.test(word) && !s.includes(" ")) {
    return word.charAt(0) + word.slice(1).toLowerCase();
  }
  return s;
}

function titleCaseWords(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Smart short name: title case, word breaks, no special characters. */
export function deriveSmartTransactionName(stripped: string): string {
  const u = stripped.toUpperCase();

  if (u.includes("RD BOOKED") || u.includes("RDBOOKED")) {
    return "RD Booked";
  }
  if (u.includes("FD BOOKED") || u.includes("FDBOOKED")) {
    return "FD Booked";
  }
  if (u.includes("BILL PAID") || u.includes("CCBILL")) {
    return "Credit Card Bill Payment";
  }
  if (u.includes("CASHBACK")) {
    return "Cashback";
  }
  if (u.includes("KOTAK811") || u.includes("KOTAK 811")) {
    return "Kotak 811";
  }
  if (u.includes("AUTOFUND") || u.includes("AUTO FUND")) {
    return "Auto Fund";
  }
  if (u.includes("BBPS") || u.includes("UPPCL")) {
    return "Uppcl Postpaid";
  }
  if (u.includes("811:BD") || u.includes("JIO PREPAID")) {
    return "Jio Prepaid";
  }
  if (u.includes("INT.PD") || u.includes("INT PD")) {
    return "Interest";
  }

  const parts = stripped.split("/").map((p) => p.trim()).filter(Boolean);
  let merchant = "";

  if (parts.length >= 2 && parts[0]!.toUpperCase() === "UPI") {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i]!;
      const compact = part.replace(/\s/g, "");
      if (/^\d{10,}$/.test(compact)) continue;
      const key = compact.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (GENERIC_PATH_PARTS.has(key)) continue;
      if (/^(PAYMENT|SENT|FROM|VIA|TO|REF|AMT)/i.test(part)) continue;
      merchant = part;
      break;
    }
    if (!merchant && parts[1]) merchant = parts[1]!;
  } else {
    merchant = parts[0] ?? stripped;
  }

  const cleaned = merchant
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withBreaks = splitCamelOrCaps(cleaned);
  const name = titleCaseWords(withBreaks);

  return (name || "Bank Transaction").slice(0, MAX_NAME_LEN);
}

export function extractKotakTransactionDetails(raw: string): {
  name: string;
  reference_no: string | null;
} {
  const bankRef = raw.match(/UPI-(\d{10,})/i)?.[1] ?? null;
  const stripped = stripKotakDescriptionTail(raw);

  return {
    name: deriveSmartTransactionName(stripped),
    reference_no: formatStatementDescription(stripped, bankRef),
  };
}

export function extractBoiTransactionDetails(remarks: string): {
  name: string;
  reference_no: string | null;
} {
  const bankRef = remarks.match(/UPI-(\d{10,})/i)?.[1] ?? null;
  const stripped = remarks.replace(/\s+/g, " ").trim();

  return {
    name: deriveSmartTransactionName(stripped),
    reference_no: formatStatementDescription(stripped, bankRef),
  };
}
