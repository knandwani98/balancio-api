/** Budget period schedule (PENDING/DUE/OVERDUE/DONE) is derived from transaction line_status + due_date at read time. */
export async function tickOccurrenceScheduleStatuses(_todayIso: string): Promise<{
  overdue_updated: number;
  due_updated: number;
}> {
  return { overdue_updated: 0, due_updated: 0 };
}
