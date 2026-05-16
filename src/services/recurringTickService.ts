import { prisma } from "../lib/prisma.js";
import { parseISODateOnly } from "../lib/prismaMappers.js";

/** Advance occurrence schedule_status by calendar. DONE/settled rows are left unchanged (see transaction create flow). */
export async function tickOccurrenceScheduleStatuses(todayIso: string): Promise<{
  overdue_updated: number;
  due_updated: number;
}> {
  const today = parseISODateOnly(todayIso);

  const overdue = await prisma.budgetOccurrence.updateMany({
    where: {
      schedule_status: { in: ["PENDING", "DUE"] },
      due_date: { lt: today },
      settled_transaction_id: null,
    },
    data: { schedule_status: "OVERDUE" },
  });

  const due = await prisma.budgetOccurrence.updateMany({
    where: {
      schedule_status: "PENDING",
      due_date: today,
      settled_transaction_id: null,
    },
    data: { schedule_status: "DUE" },
  });

  return { overdue_updated: overdue.count, due_updated: due.count };
}
