export function normalizePlanHoldingBroker(data: {
  broker?: string;
  broker_name?: string | null;
}) {
  const broker = data.broker ?? "zerodha";
  return {
    broker,
    broker_name: broker === "other" ? data.broker_name?.trim() ?? null : null,
  };
}
