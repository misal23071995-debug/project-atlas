"use server";

import { revalidatePath } from "next/cache";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { copyWeek, createLeave, deleteShift, getLeave, saveShift, setLeaveStatus } from "@/app/lib/db/roster";
import {
  addDays,
  daysBetween,
  isIsoDate,
  LEAVE_TYPES,
  weekStart,
  type LeaveType,
  type ShiftBreak,
} from "@/app/lib/roster/types";

const MAX_LEAVE_DAYS = 60;

async function assertMember(orgId: string, userId: string) {
  if (!(await listMembers(orgId)).some((m) => m.id === userId)) {
    throw new Error("That person isn't in this workspace.");
  }
}

// ---- Shifts (admins and team leads) ----

export async function saveShiftAction(input: {
  userId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  breaks: ShiftBreak[];
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { org } = await requireSession("roster.manage");

  const start = Math.round(Number(input.startMinute));
  let end = Math.round(Number(input.endMinute));
  if (!isIsoDate(input.date)) return { ok: false, error: "Pick a date." };
  if (!(start >= 0 && start < 1440) || !(end >= 0 && end <= 2880)) return { ok: false, error: "Enter valid times." };
  // An end time earlier than the start means the shift runs past midnight
  if (end <= start) end += 1440;
  if (end - start > 16 * 60) return { ok: false, error: "A shift can be at most 16 hours." };

  const breaks = (Array.isArray(input.breaks) ? input.breaks : []).slice(0, 6).map((b) => {
    let breakStart = Math.round(Number(b.start));
    if (breakStart < start) breakStart += 1440;
    return { start: breakStart, minutes: Math.round(Number(b.minutes)) };
  });
  for (const b of breaks) {
    if (!(b.minutes > 0 && b.minutes <= 240) || b.start < start || b.start + b.minutes > end) {
      return { ok: false, error: "Each break must fit inside the shift." };
    }
  }

  try {
    await assertMember(org.id, input.userId);
    await saveShift(org.id, {
      userId: input.userId,
      date: input.date,
      startMinute: start,
      endMinute: end,
      breaks: breaks.sort((a, b) => a.start - b.start),
      note: String(input.note ?? "").trim().slice(0, 200) || null,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the shift." };
  }

  revalidatePath("/roster");
  return { ok: true };
}

export async function deleteShiftAction(userId: string, date: string): Promise<{ ok: boolean; error?: string }> {
  const { org } = await requireSession("roster.manage");
  if (!isIsoDate(date)) return { ok: false, error: "Pick a date." };

  try {
    await deleteShift(org.id, userId, date);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not remove the shift." };
  }

  revalidatePath("/roster");
  return { ok: true };
}

// Fills empty days in this week with the same shifts as the week before
export async function copyPreviousWeekAction(monday: string): Promise<{ ok: boolean; error?: string; added?: number }> {
  const { org } = await requireSession("roster.manage");
  if (!isIsoDate(monday)) return { ok: false, error: "Pick a week." };
  const thisWeek = weekStart(monday);

  try {
    const members = await listMembers(org.id);
    const added = await copyWeek(org.id, addDays(thisWeek, -7), thisWeek, members.map((m) => m.id));
    revalidatePath("/roster");
    return { ok: true, added };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not copy the week." };
  }
}

// ---- Leave ----

export interface LeaveFormState {
  error?: string;
  success?: string;
}

// Anyone can ask for leave for themselves
export async function requestLeaveAction(_previous: LeaveFormState, formData: FormData): Promise<LeaveFormState> {
  const { agent, org } = await requireSession();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "") || startDate;
  const type = String(formData.get("type") ?? "annual") as LeaveType;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return { error: "Pick the first and last day." };
  if (endDate < startDate) return { error: "The last day can't be before the first day." };
  if (daysBetween(startDate, endDate) >= MAX_LEAVE_DAYS) return { error: `Request at most ${MAX_LEAVE_DAYS} days at a time.` };
  if (!LEAVE_TYPES.includes(type)) return { error: "Choose a leave type." };

  try {
    await createLeave(org.id, { userId: agent.id, startDate, endDate, type, note });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not request leave." };
  }

  revalidatePath("/roster", "layout");
  return { success: "Leave requested. A team lead will approve it." };
}

export async function decideLeaveAction(id: string, decision: "approved" | "rejected") {
  const { agent, org } = await requireSession("roster.manage");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Unknown decision");

  const leave = await getLeave(org.id, id);
  if (!leave) throw new Error("Leave request not found");
  if (leave.status === "cancelled") throw new Error("This request was cancelled.");

  await setLeaveStatus(org.id, id, decision, agent.name);
  revalidatePath("/roster", "layout");
}

// People can cancel their own requests; leads can cancel anyone's
export async function cancelLeaveAction(id: string) {
  const { agent, org, role } = await requireSession();

  const leave = await getLeave(org.id, id);
  if (!leave) throw new Error("Leave request not found");
  if (leave.userId !== agent.id && !can(role, "roster.manage")) {
    throw new Error("You can only cancel your own leave.");
  }

  await setLeaveStatus(org.id, id, "cancelled", null);
  revalidatePath("/roster", "layout");
}
