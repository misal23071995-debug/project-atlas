import "server-only";
import { getSupabase } from "./supabase";
import { addDays, daysBetween, type LeaveRequest, type LeaveStatus, type LeaveType, type Shift, type ShiftBreak } from "@/app/lib/roster/types";

// Every function takes the workspace id and only touches that workspace's roster

type ShiftRow = {
  user_id: string;
  shift_date: string;
  start_minute: number;
  end_minute: number;
  breaks: ShiftBreak[];
  note: string | null;
};

const SHIFT_COLUMNS = "user_id, shift_date, start_minute, end_minute, breaks, note";

function toShift(row: ShiftRow): Shift {
  return {
    userId: row.user_id,
    date: row.shift_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    breaks: row.breaks ?? [],
    note: row.note,
  };
}

// Shifts from `from` to `to`, both dates included. Null until migration 008 has been run.
export async function listShifts(orgId: string, from: string, to: string): Promise<Shift[] | null> {
  const { data, error } = await getSupabase()
    .from("shifts")
    .select(SHIFT_COLUMNS)
    .eq("org_id", orgId)
    .gte("shift_date", from)
    .lte("shift_date", to)
    .returns<ShiftRow[]>();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load roster: ${error.message}`);
  return data.map(toShift);
}

// One shift per person per day: saving again replaces it
export async function saveShift(orgId: string, shift: Shift) {
  const { error } = await getSupabase()
    .from("shifts")
    .upsert(
      {
        org_id: orgId,
        user_id: shift.userId,
        shift_date: shift.date,
        start_minute: shift.startMinute,
        end_minute: shift.endMinute,
        breaks: shift.breaks,
        note: shift.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,user_id,shift_date" }
    );

  if (error) throw new Error(`Failed to save shift: ${error.message}`);
}

export async function deleteShift(orgId: string, userId: string, date: string) {
  const { error } = await getSupabase()
    .from("shifts")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("shift_date", date);

  if (error) throw new Error(`Failed to remove shift: ${error.message}`);
}

// Copies the week starting `fromMonday` into the week starting `toMonday`, for the given people.
// Days that already have a shift are left alone. Returns how many shifts were added.
export async function copyWeek(orgId: string, fromMonday: string, toMonday: string, userIds: string[]) {
  const [source, target] = await Promise.all([
    listShifts(orgId, fromMonday, addDays(fromMonday, 6)),
    listShifts(orgId, toMonday, addDays(toMonday, 6)),
  ]);
  if (!source || !target) throw new Error("Run migration 008 first.");

  const taken = new Set(target.map((s) => `${s.userId}:${s.date}`));
  const offset = daysBetween(fromMonday, toMonday);
  const members = new Set(userIds);

  const rows = source
    .filter((s) => members.has(s.userId))
    .map((s) => ({ ...s, date: addDays(s.date, offset) }))
    .filter((s) => !taken.has(`${s.userId}:${s.date}`))
    .map((s) => ({
      org_id: orgId,
      user_id: s.userId,
      shift_date: s.date,
      start_minute: s.startMinute,
      end_minute: s.endMinute,
      breaks: s.breaks,
      note: s.note,
    }));

  if (rows.length === 0) return 0;
  const { error } = await getSupabase().from("shifts").insert(rows);
  if (error) throw new Error(`Failed to copy shifts: ${error.message}`);
  return rows.length;
}

// ---- Leave ----

type LeaveRow = {
  id: number;
  user_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  status: LeaveStatus;
  note: string | null;
  decided_by: string | null;
  created_at: string;
};

const LEAVE_COLUMNS = "id, user_id, start_date, end_date, leave_type, status, note, decided_by, created_at";

function toLeave(row: LeaveRow): LeaveRequest {
  return {
    id: String(row.id),
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    type: row.leave_type,
    status: row.status,
    note: row.note,
    decidedBy: row.decided_by,
    createdAt: row.created_at,
  };
}

// Leave that overlaps the dates, or (with no dates) everything from the last 90 days on
export async function listLeave(
  orgId: string,
  { from, to, userId }: { from?: string; to?: string; userId?: string } = {}
): Promise<LeaveRequest[] | null> {
  let query = getSupabase()
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .eq("org_id", orgId)
    .order("start_date", { ascending: true });

  if (to) query = query.lte("start_date", to);
  query = query.gte("end_date", from ?? addDays(new Date().toISOString().slice(0, 10), -90));
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.returns<LeaveRow[]>();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load leave: ${error.message}`);
  return data.map(toLeave);
}

export async function createLeave(
  orgId: string,
  leave: { userId: string; startDate: string; endDate: string; type: LeaveType; note: string }
) {
  const { error } = await getSupabase().from("leave_requests").insert({
    org_id: orgId,
    user_id: leave.userId,
    start_date: leave.startDate,
    end_date: leave.endDate,
    leave_type: leave.type,
    note: leave.note || null,
  });

  if (error) throw new Error(`Failed to request leave: ${error.message}`);
}

export async function getLeave(orgId: string, id: string): Promise<LeaveRequest | null> {
  if (!/^\d+$/.test(id)) return null;
  const { data, error } = await getSupabase()
    .from("leave_requests")
    .select(LEAVE_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .returns<LeaveRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load leave: ${error.message}`);
  return data ? toLeave(data) : null;
}

export async function setLeaveStatus(orgId: string, id: string, status: LeaveStatus, decidedBy: string | null) {
  const { error } = await getSupabase()
    .from("leave_requests")
    .update({ status, decided_by: decidedBy, decided_at: decidedBy ? new Date().toISOString() : null })
    .eq("org_id", orgId)
    .eq("id", id);

  if (error) throw new Error(`Failed to update leave: ${error.message}`);
}
