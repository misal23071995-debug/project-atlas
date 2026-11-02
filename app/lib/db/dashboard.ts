import "server-only";
import { getSupabase } from "./supabase";
import {
  TICKET_PRIORITIES,
  type TicketPriority,
  type TicketStatus,
} from "@/app/lib/tickets";

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
  backlogByPriority: { priority: TicketPriority; count: number }[];
  byChannel: { channel: string; total: number; open: number }[];
  byAgent: { name: string; open: number; resolved: number }[];
  recent: RecentTicket[];
}

function isOpen(status: TicketStatus) {
  return !CLOSED_STATUSES.includes(status);
}

// Reads every ticket and summarises it in memory. Fine for thousands of
// tickets; move the counting into SQL views if the table grows far beyond that.
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabase();

  const [ticketsRes, repliesRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, subject, priority, status, assigned_to, channel, created_at, updated_at, customer:customers (name)"
      )
      .order("updated_at", { ascending: false })
      .returns<DashboardTicketRow[]>(),
    supabase
      .from("ticket_messages")
      .select("ticket_id, created_at")
      .eq("role", "agent")
      .order("created_at", { ascending: true }),
  ]);

  if (ticketsRes.error) throw new Error(`Failed to load dashboard: ${ticketsRes.error.message}`);
  if (repliesRes.error) throw new Error(`Failed to load dashboard: ${repliesRes.error.message}`);

  const tickets = ticketsRes.data;
  const now = Date.now();
  const openTickets = tickets.filter((t) => isOpen(t.status));

  // "Today" means the last 24 hours, so it doesn't depend on a time zone
  const newToday = tickets.filter((t) => now - Date.parse(t.created_at) < DAY_MS).length;

  // A resolved ticket's updated_at is when it was last changed, which is close enough to when it was resolved
  const resolvedThisWeek = tickets.filter(
    (t) => !isOpen(t.status) && now - Date.parse(t.updated_at) < 7 * DAY_MS
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
