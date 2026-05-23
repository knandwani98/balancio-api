/** YYYY-MM-DD in UTC (calendar date for MVP) */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in UTC (YYYY-MM-DD). */
export function utcTodayISO(): string {
  return toISODate(new Date());
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

export function addDaysUTC(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n)
  );
}

export function addWeeksUTC(d: Date, n: number): Date {
  return addDaysUTC(d, 7 * n);
}

/** Monday 00:00 UTC of the ISO week containing `d` (week starts Monday). */
export function startOfISOWeekMondayUTC(d: Date): Date {
  const dow = d.getUTCDay();
  const daysSinceMon = (dow + 6) % 7;
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMon)
  );
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
