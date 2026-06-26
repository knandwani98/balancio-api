const PRESET_PLAN_NAMES = [
  "Mutual Funds",
  "Fixed Deposits",
  "Digital Assets",
  "Stocks",
  "Global Funds",
  "NPS",
  "EPF",
  "Bonds",
  "PPF",
  "ESOPs/RSUs",
  "Wallets",
  "Other",
] as const;

export function planNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\/\s*/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function planNameFromSlug(slug: string): string | null {
  const normalized = slug.toLowerCase();
  return PRESET_PLAN_NAMES.find((name) => planNameToSlug(name) === normalized) ?? null;
}

export function planNamesMatchSlug(planName: string, slug: string): boolean {
  const normalized = slug.toLowerCase();
  if (planNameToSlug(planName) === normalized) return true;
  const preset = planNameFromSlug(normalized);
  if (!preset) return false;
  return planName.localeCompare(preset, undefined, { sensitivity: "accent" }) === 0;
}
