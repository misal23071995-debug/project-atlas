import "server-only";
import { getSupabase } from "./supabase";
import {
  TICKET_PRIORITIES,
  type TicketPriority,
  type TicketStatus,
} from "@/app/lib/tickets";
import { firstResponseClock, isAtRisk, isBreached, resolutionClock, type TicketSla } from "@/app/lib/sla";

const CLOSED_STATUSES: TicketStatus[] = ["Resolved", "Closed"];
const DAY_MS = 24 * 60 * 60 * 1000;

type DashboardTicketRow = {
  id: number;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string;
  channel: string;
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_minutes: number;
  customer: { name: string } | null;
};

export interface RecentTicket {
  id: string;
  subject: string;
  customer: string;
  channel: string;
  assignedTo: string;
  status: TicketStatus;
  updatedAt: string;
}

export interface DashboardStats {
  // When these numbers were read, for showing relative times like "5 min ago"
  generatedAt: number;
  open: number;
  needsAttention: number;
  unassigned: number;
  escalated: number;
  newToday: number;
  resolvedThisWeek: number;
  // Average minutes from a ticket being created to the first agent reply; null with no replies yet
  avgFirstResponseMinutes: number | null;
  // Open tickets past a due time, and those close to one
  slaBreached: number;
  slaAtRisk: number;
  // Share of SLA clocks that finished in the last 7 days on time; null when none finished
  slaMetPercent: number | null;
  backlogByPriority: { priority: TicketPriority; count: number }[];
  byChannel: { channel: string; total: number; open: number }[];
  byAgent: { name: string; open: number; resolved: number }[];
  recent: RecentTicket[];
}

function toSla(t: DashboardTicketRow): TicketSla {
  return {
    priority: t.priority,
    status: t.status,
    createdAt: t.created_at,
    firstResponseAt: t.first_response_at,
    resolvedAt: t.resolved_at,
    firstResponseDueAt: t.first_response_due_at,
    resolutionDueAt: t.resolution_due_at,
    slaPausedAt: t.sla_paused_at,
    slaPausedMinutes: t.sla_paused_minutes,
  };
}

function isOpen(status: TicketStatus) {
  return !CLOSED_STATUSES.includes(status);
}

// Reads every ticket and summarises it in memory. Fine for thousands of
// tickets; move the counting into SQL views if the table grows far beyond that.
export async function getDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = getSupabase();

  const [ticketsRes, repliesRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, subject, priority, status, assigned_to, channel, created_at, updated_at, first_response_at, resolved_at, first_response_due_at, resolution_due_at, sla_paused_at, sla_paused_minutes, customer:customers (name)"
      )
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .returns<DashboardTicketRow[]>(),
    supabase
      .from("ticket_messages")
      // Inner join so only replies on this workspace's tickets come back
      .select("ticket_id, created_at, ticket:tickets!inner (org_id)")
      .eq("role", "agent")
      .eq("ticket.org_id", orgId)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketsRes.error) throw new Error(`Failed to load dashboard: ${ticketsRes.error.message}`);
  if (repliesRes.error) throw new Error(`Failed to load dashboard: ${repliesRes.error.message}`);

  const tickets = ticketsRes.data;
  const now = Date.now();
  const openTickets = tickets.filter((t) => isOpen(t.status));

  // "Today" means the last 24 hours, so it doesn't depend on a time zone
  const newToday = tickets.filter((t) => now - Date.parse(t.created_at) < DAY_MS).length;

  const resolvedThisWeek = tickets.filter(
    (t) => !isOpen(t.status) && now - Date.parse(t.resolved_at ?? t.updated_at) < 7 * DAY_MS
  ).length;

  // Replies are sorted oldest first, so the first one seen per ticket is the first response
  const firstReplyAt = new Map<number, number>();
  for (const reply of repliesRes.data) {
    if (!firstReplyAt.has(reply.ticket_id)) {
      firstReplyAt.set(reply.ticket_id, Date.parse(reply.created_at));
    }
  }

  const responseMinutes = tickets
    .filter((t) => firstReplyAt.has(t.id))
    .map((t) => Math.max(0, (firstReplyAt.get(t.id)! - Date.parse(t.created_at)) / 60000));

  const avgFirstResponseMinutes = responseMinutes.length
    ? responseMinutes.reduce((sum, minutes) => sum + minutes, 0) / responseMinutes.length
    : null;

  const slaTickets = tickets.map(toSla);
  // Every reply or resolution clock that stopped in the last week counts once
  let finished = 0;
  let met = 0;
  for (const t of slaTickets) {
    for (const c of [firstResponseClock(t, now), resolutionClock(t, now)]) {
      if (!c?.doneAt || now - Date.parse(c.doneAt) >= 7 * DAY_MS) continue;
      finished += 1;
      if (c.state === "met") met += 1;
    }
  }

  const channels = new Map<string, { total: number; open: number }>();
  for (const t of tickets) {
    const entry = channels.get(t.channel) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (isOpen(t.status)) entry.open += 1;
    channels.set(t.channel, entry);
  }

  const agents = new Map<string, { open: number; resolved: number }>();
  for (const t of tickets) {
    if (t.assigned_to === "Unassigned") continue;
    const entry = agents.get(t.assigned_to) ?? { open: 0, resolved: 0 };
    if (isOpen(t.status)) entry.open += 1;
    else entry.resolved += 1;
    agents.set(t.assigned_to, entry);
  }

  return {
    generatedAt: now,
    open: openTickets.length,
    needsAttention: openTickets.filter((t) => t.priority === "Urgent" || t.priority === "High").length,
    unassigned: openTickets.filter((t) => t.assigned_to === "Unassigned").length,
    escalated: openTickets.filter((t) => t.status === "Escalated").length,
    slaBreached: slaTickets.filter((t) => isBreached(t, now)).length,
    slaAtRisk: slaTickets.filter((t) => isAtRisk(t, now)).length,
    slaMetPercent: finished ? Math.round((met / finished) * 100) : null,
    newToday,
    resolvedThisWeek,
    avgFirstResponseMinutes,
    backlogByPriority: [...TICKET_PRIORITIES].reverse().map((priority) => ({
      priority,
      count: openTickets.filter((t) => t.priority === priority).length,
    })),
    byChannel: [...channels]
      .map(([channel, counts]) => ({ channel, ...counts }))
      .sort((a, b) => b.total - a.total),
    byAgent: [...agents]
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.open + b.resolved - (a.open + a.resolved))
      .slice(0, 5),
    recent: tickets.slice(0, 5).map((t) => ({
      id: String(t.id),
      subject: t.subject,
      customer: t.customer?.name ?? "Unknown",
      channel: t.channel,
      assignedTo: t.assigned_to,
      status: t.status,
      updatedAt: t.updated_at,
    })),
  };
}
