import type { OccurrenceScheduleStatus, TransactionLineStatus } from "../types/database.js";
import { utcTodayISO } from "../utils/dates.js";

/** Derive budget period schedule label from transaction fields (UTC calendar). */
export function deriveScheduleStatus(
  lineStatus: TransactionLineStatus,
  dueDateIso: string,
  todayIso: string = utcTodayISO()
): OccurrenceScheduleStatus {
  if (lineStatus === "cleared") return "DONE";
  if (lineStatus === "failed") return "OVERDUE";
  if (dueDateIso < todayIso) return "OVERDUE";
  if (dueDateIso === todayIso) return "DUE";
  return "PENDING";
}
