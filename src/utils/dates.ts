/** YYYY-MM-DD in UTC (calendar date for MVP) */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function startOfMonthUTC(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0, 1));
}

export function addMonthsUTC(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + n, 1));
}

/** Clamp day to last valid day in month (UTC). */
export function dueDateInMonth(year: number, monthIndex0: number, dueDay: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return new Date(Date.UTC(year, monthIndex0, day));
}

export function periodStartForDate(d: Date): string {
  return toISODate(startOfMonthUTC(d.getUTCFullYear(), d.getUTCMonth()));
}
