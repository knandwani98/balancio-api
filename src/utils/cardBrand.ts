/** Digits-only PAN; last 4 used for display labels (full number is not stored). */
export function getLast4(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 4) {
    throw new Error("Card number must have at least 4 digits");
  }
  return digits.slice(-4);
}

/** Detect card network from full PAN in memory only; persist last4 + brand, not full number. */
export function getCardType(cardNumber: string): string {
  const number = cardNumber.replace(/\s|-/g, "");
  const patterns: Record<string, RegExp> = {
    Visa: /^4\d{12}(\d{3})?(\d{3})?$/,
    MasterCard: /^(5[1-5]\d{14}|2(2[2-9]\d|[3-6]\d{2}|7([01]\d|20))\d{12})$/,
    RuPay: /^(508\d{12}|60\d{14}|65\d{14}|81\d{14}|82\d{14})$/,
    Amex: /^3[47]\d{13}$/,
    Discover: /^(6011\d{12}|65\d{14}|64[4-9]\d{13})$/,
    Diners: /^3(0[0-5]|[68]\d)\d{11}$/,
    JCB: /^35(2[89]|[3-8]\d)\d{12,15}$/,
  };
  for (const [type, regex] of Object.entries(patterns)) {
    if (regex.test(number)) return type;
  }
  return "Unknown";
}
