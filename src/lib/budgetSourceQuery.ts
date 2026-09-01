const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BudgetPaymentSourceFilter = {
  bankAccountIds: string[];
  cardIds: string[];
  walletIds: string[];
  includeCash: boolean;
  paymentMethods: string[];
};

function parseIdList(value: unknown): string[] {
  if (value == null || value === "") return [];
  const parts = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const part of parts) {
    for (const token of String(part).split(",")) {
      const id = token.trim();
      if (UUID_RE.test(id)) ids.push(id);
    }
  }
  return ids;
}

function parseMethodList(value: unknown): string[] {
  if (value == null || value === "") return [];
  const parts = Array.isArray(value) ? value : [value];
  const methods: string[] = [];
  for (const part of parts) {
    for (const token of String(part).split(",")) {
      const method = token.trim();
      if (method && method !== "cash") methods.push(method);
    }
  }
  return methods;
}

function isTrue(value: unknown): boolean {
  return value === "true" || value === "1" || value === true;
}

function hasOwnQuery(query: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(query, key);
}

/** When any source query param is present, list/occurrences are filtered to those sources. */
export function parseBudgetSourceQuery(
  query: Record<string, unknown>
): BudgetPaymentSourceFilter | undefined {
  const hasFilter =
    query.sources === "filter" ||
    hasOwnQuery(query, "bank_account_id") ||
    hasOwnQuery(query, "card_id") ||
    hasOwnQuery(query, "wallet_id") ||
    hasOwnQuery(query, "include_cash") ||
    hasOwnQuery(query, "payment_method");
  if (!hasFilter) return undefined;

  return {
    bankAccountIds: parseIdList(query.bank_account_id),
    cardIds: parseIdList(query.card_id),
    walletIds: parseIdList(query.wallet_id),
    includeCash: isTrue(query.include_cash),
    paymentMethods: parseMethodList(query.payment_method),
  };
}

export function budgetSourceFilterIsEmpty(filter: BudgetPaymentSourceFilter): boolean {
  return (
    filter.bankAccountIds.length === 0 &&
    filter.cardIds.length === 0 &&
    filter.walletIds.length === 0 &&
    !filter.includeCash &&
    filter.paymentMethods.length === 0
  );
}
