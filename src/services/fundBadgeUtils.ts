export const FUND_BADGE_COLORS = [
  "bg-sky-600 text-white",
  "bg-amber-500 text-white",
  "bg-rose-600 text-white",
  "bg-indigo-600 text-white",
  "bg-orange-600 text-white",
  "bg-red-600 text-white",
  "bg-emerald-600 text-white",
  "bg-blue-700 text-white",
  "bg-violet-600 text-white",
  "bg-teal-600 text-white",
] as const;

export function fundNameToInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export function randomBadgeColor(): string {
  return FUND_BADGE_COLORS[Math.floor(Math.random() * FUND_BADGE_COLORS.length)];
}
