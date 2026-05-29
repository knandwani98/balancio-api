export type ParsedStatementLine = {
  /** Zero-based row index as it appears on the statement (top → bottom). */
  statement_order: number;
  occurred_at: string;
  /** Merchant / transaction label saved on the transaction. */
  name: string;
  /** UPI or bank reference when present in the statement. */
  reference_no: string | null;
  type: "income" | "expense";
  amount: number;
  note: string | null;
};

export type ParsedStatementResult = {
  lines: ParsedStatementLine[];
  /** Opening balance from the statement (before listed transactions). */
  opening_balance: number | null;
  closing_balance: number | null;
};

export type StatementImportBankId = "kotak" | "boi";
