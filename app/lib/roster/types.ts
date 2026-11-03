// Roster shifts and leave. Dates are "YYYY-MM-DD" strings and times are minutes from
// midnight, both in the team's local time, so nothing here depends on a time zone.
// Safe to import from Client Components.

export interface ShiftBreak {
  // Minutes from midnight on the shift's date (can pass 1440 on overnight shifts)
  start: number;
  minutes: number;
}

export interface Shift {
  userId: string;
  date: string;
  startMinute: number;
  // Above 1440 when the shift ends after midnight
  endMinute: number;
  breaks: ShiftBreak[];
  note: string | null;
}

export const LEAVE_TYPES = ["annual", "sick", "unpaid", "other"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  unpaid: "Unpaid leave",
  other: "Other",
};

export type LeaveStatus = "requested" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  userId: string;
  // Filled in by the page from the team list
  userName?: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  status: LeaveStatus;
  note: string | null;
  decidedBy: string | null;
  createdAt: string;
}

// Quick picks in the shift editor
export const SHIFT_TEMPLATES: { name: string; start: number; end: number; breaks: ShiftBreak[] }[] = [
  { name: "Early", start: 6 * 60, end: 14 * 60 + 30, breaks: [{ start: 10 * 60, minutes: 30 }] },
  { name: "Day", start: 9 * 60, end: 17 * 60 + 30, breaks: [{ start: 13 * 60, minutes: 30 }] },
  { name: "Late", start: 14 * 60, end: 22 * 60 + 30, breaks: [{ start: 18 * 60, minutes: 30 }] },
  { name: "Night", start: 22 * 60, end: 30 * 60 + 30, breaks: [{ start: 26 * 60, minutes: 30 }] },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// The Monday on or before the date
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function weekDates(monday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

// 570 -> "09:30", 1530 -> "01:30" (next day)
export function formatMinutes(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// "09:30" -> 570; null if it isn't a time
export function parseTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function shiftLabel(shift: Pick<Shift, "startMinute" | "endMinute">) {
  return `${formatMinutes(shift.startMinute)}–${formatMinutes(shift.endMinute)}`;
}

// Working time without breaks
export function paidMinutes(shift: Pick<Shift, "startMinute" | "endMinute" | "breaks">) {
  const breakMinutes = shift.breaks.reduce((sum, b) => sum + b.minutes, 0);
  return Math.max(0, shift.endMinute - shift.startMinute - breakMinutes);
}

export function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// "Mon 3 Nov"
export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function leaveCovers(leave: Pick<LeaveRequest, "startDate" | "endDate">, date: string) {
  return leave.startDate <= date && date <= leave.endDate;
}
