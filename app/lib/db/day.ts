import "server-only";
import { getSupabase } from "./supabase";
import { addDays, localDate, startOfLocalDay } from "@/app/lib/reports/period";
import { TICKET_PRIORITIES, TICKET_STATUSES, type TicketPriority, type TicketStatus } from "@/app/lib/tickets";

// One day of incoming tickets in the team's time zone: how many, when, and how they split

export interface Split {
  label: string;
  count: number;
}

export interface DayStats {
  date: string;
  isToday: boolean;
  received: number;
  // The whole day before, and the day before up to the same time of day (only for today)
  yesterday: number;
  yesterdaySoFar: number | null;
  resolved: number;
  // Of the tickets received that day, how many have had a reply, and the median wait for it
  replied: number;
  medianFirstReplyMinutes: number | null;
  hourly: number[];
  hourlyYesterday: number[];
  // The hour of day (0-23) that has passed so far, for today
  currentHour: number | null;
  byChannel: Split[];
  byCategory: Split[];
  byPriority: Split[];
  byStatus: Split[];
}

type Row = {
  created_at: string;
  channel: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  first_response_at: string | null;
};

function hourOf(iso: string, timezone: string) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return Number(h) % 24;
}

function split(rows: Row[], key: (r: Row) => string, order?: readonly string[], top = 8): Split[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(key(r), (counts.get(key(r)) ?? 0) + 1);
  let list = [...counts].map(([label, count]) => ({ label, count }));
  if (order) return order.map((label) => ({ label, count: counts.get(label) ?? 0 }));
  list = list.sort((a, b) => b.count - a.count);
  if (list.length <= top) return list;
  const rest = list.slice(top - 1).reduce((sum, s) => sum + s.count, 0);
  return [...list.slice(0, top - 1), { label: "Everything else", count: rest }];
}

export async function getDayStats(orgId: string, date: string, timezone: string, now = Date.now()): Promise<DayStats> {
  const supabase = getSupabase();
  const today = localDate(now, timezone);
  const start = startOfLocalDay(date, timezone);
  const end = startOfLocalDay(addDays(date, 1), timezone);
  const prevStart = startOfLocalDay(addDays(date, -1), timezone);
  const iso = (ms: number) => new Date(ms).toISOString();

  const [ticketsRes, resolvedRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("created_at, channel, category, priority, status, first_response_at")
      .eq("org_id", orgId)
      .gte("created_at", iso(prevStart))
      .lt("created_at", iso(end))
      .limit(20000)
      .returns<Row[]>(),
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["Resolved", "Closed"])
      .gte("resolved_at", iso(start))
      .lt("resolved_at", iso(end)),
  ]);
  if (ticketsRes.error) throw new Error(`Failed to load the day: ${ticketsRes.error.message}`);

  const inDay = ticketsRes.data.filter((t) => Date.parse(t.created_at) >= start);
  const prevDay = ticketsRes.data.filter((t) => Date.parse(t.created_at) < start);
  const isToday = date === today;

  const hourly = Array<number>(24).fill(0);
  const hourlyYesterday = Array<number>(24).fill(0);
  for (const t of inDay) hourly[hourOf(t.created_at, timezone)] += 1;
  for (const t of prevDay) hourlyYesterday[hourOf(t.created_at, timezone)] += 1;

  // Today is compared with yesterday up to the same time, so a morning doesn't look like a quiet day
  const elapsed = now - start;
  const yesterdaySoFar = isToday ? prevDay.filter((t) => Date.parse(t.created_at) - prevStart <= elapsed).length : null;

  const waits = inDay
    .filter((t) => t.first_response_at)
    .map((t) => Math.max(0, (Date.parse(t.first_response_at!) - Date.parse(t.created_at)) / 60000))
    .sort((a, b) => a - b);
  const median = waits.length ? (waits.length % 2 ? waits[(waits.length - 1) / 2] : (waits[waits.length / 2 - 1] + waits[waits.length / 2]) / 2) : null;

  return {
    date,
    isToday,
    received: inDay.length,
    yesterday: prevDay.length,
    yesterdaySoFar,
    resolved: resolvedRes.count ?? 0,
    replied: waits.length,
    medianFirstReplyMinutes: median,
    hourly,
    hourlyYesterday,
    currentHour: isToday ? hourOf(iso(now), timezone) : null,
    byChannel: split(inDay, (t) => t.channel),
    byCategory: split(inDay, (t) => t.category),
    byPriority: split(inDay, (t) => t.priority, [...TICKET_PRIORITIES].reverse()),
    byStatus: split(inDay, (t) => t.status, TICKET_STATUSES),
  };
}
