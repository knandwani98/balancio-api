/** Parse amounts like `1,25,544.16` or `25500.00`. */
export function parseIndianAmount(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return n;
}

export function amountsRoughlyEqual(a: number, b: number, epsilon = 0.02): boolean {
  return Math.abs(a - b) <= epsilon;
}
