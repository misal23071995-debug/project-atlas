import "server-only";
import { getSupabase } from "./supabase";
import { listCustomerOrders } from "./orders";
import { isPaid, type Order } from "@/app/lib/orders";
import type { Customer, TicketPriority, TicketStatus } from "@/app/lib/tickets";

// Customers as one record across every channel: their tickets, chats and orders together

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  location: string | null;
  device: string | null;
  orders: number;
  csat: number | null;
  created_at: string;
};

const CUSTOMER_COLUMNS = "id, name, email, location, device, orders, csat, created_at";

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    location: row.location ?? "Unknown",
    device: row.device ?? "Unknown",
    orders: row.orders,
    csat: row.csat,
    customerSince: row.created_at,
  };
}

export interface CustomerListItem extends Customer {
  tickets: number;
  openTickets: number;
  lastContactAt: string | null;
}

const PAGE = 50;

// Most recently in touch first. Search matches name or email.
export async function listCustomers(orgId: string, { search = "", page = 1 } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from("customers")
    .select(`${CUSTOMER_COLUMNS}, tickets (status, created_at)`, { count: "exact" })
    .eq("org_id", orgId);

  const term = search.trim().replace(/[%_,()]/g, " ").slice(0, 100);
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1)
    .returns<(CustomerRow & { tickets: { status: TicketStatus; created_at: string }[] })[]>();
  if (error) throw new Error(`Failed to load customers: ${error.message}`);

  const items: CustomerListItem[] = data.map((row) => {
    const latest = row.tickets.reduce<string | null>((max, t) => (!max || t.created_at > max ? t.created_at : max), null);
    return {
      ...toCustomer(row),
      tickets: row.tickets.length,
      openTickets: row.tickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length,
      lastContactAt: latest,
    };
  });
  // Within the page, the people most recently in touch come first
  items.sort((a, b) => (b.lastContactAt ?? b.customerSince).localeCompare(a.lastContactAt ?? a.customerSince));
  return { items, total: count ?? items.length, pageSize: PAGE };
}

export interface ProfileTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: string;
  assignedTo: string;
  createdAt: string;
  csatRating: number | null;
}

export interface ProfileChat {
  id: string;
  status: "active" | "resolved" | "handed_off";
  topic: string | null;
  createdAt: string;
  csatRating: number | null;
  ticketId: string | null;
}

export type TimelineEvent =
  | { kind: "ticket"; at: string; ticket: ProfileTicket }
  | { kind: "chat"; at: string; chat: ProfileChat }
  | { kind: "order"; at: string; order: Order };

export interface CustomerProfile {
  customer: Customer;
  tickets: ProfileTicket[];
  chats: ProfileChat[];
  // Null until migration 015 has been run
  orders: Order[] | null;
  timeline: TimelineEvent[];
  stats: {
    spent: number;
    currency: string;
    paidOrders: number;
    openTickets: number;
    // Average of ticket and chat ratings, 1-5
    csat: number | null;
    ratings: number;
  };
}

export async function getCustomerProfile(orgId: string, customerId: string): Promise<CustomerProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) return null;
  const supabase = getSupabase();

  const { data: row, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", customerId)
    .returns<CustomerRow[]>()
    .maybeSingle();
  if (error) throw new Error(`Failed to load the customer: ${error.message}`);
  if (!row) return null;

  const [ticketsRes, chatsRes, orders] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, subject, status, priority, channel, assigned_to, created_at, csat_rating")
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("bot_conversations")
      .select("id, status, topic, created_at, csat_rating, ticket_id")
      .eq("org_id", orgId)
      .eq("customer_email", row.email)
      .gt("customer_messages", 0)
      .order("created_at", { ascending: false })
      .limit(200),
    listCustomerOrders(orgId, customerId),
  ]);
  if (ticketsRes.error) throw new Error(`Failed to load tickets: ${ticketsRes.error.message}`);

  const tickets: ProfileTicket[] = ticketsRes.data.map((t) => ({
    id: String(t.id),
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    channel: t.channel,
    assignedTo: t.assigned_to,
    createdAt: t.created_at,
    csatRating: t.csat_rating,
  }));
  const chats: ProfileChat[] = (chatsRes.data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    topic: c.topic,
    createdAt: c.created_at,
    csatRating: c.csat_rating,
    ticketId: c.ticket_id ? String(c.ticket_id) : null,
  }));

  const timeline: TimelineEvent[] = [
    ...tickets.map((ticket) => ({ kind: "ticket" as const, at: ticket.createdAt, ticket })),
    // A chat that became a ticket shows once, as the ticket
    ...chats.filter((c) => !c.ticketId).map((chat) => ({ kind: "chat" as const, at: chat.createdAt, chat })),
    ...(orders ?? []).map((order) => ({ kind: "order" as const, at: order.placedAt, order })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const ratings = [...tickets.map((t) => t.csatRating), ...chats.map((c) => c.csatRating)].filter((r): r is number => r !== null);
  const paid = (orders ?? []).filter(isPaid);

  return {
    customer: toCustomer(row),
    tickets,
    chats,
    orders,
    timeline,
    stats: {
      spent: paid.reduce((sum, o) => sum + o.total, 0),
      currency: paid[0]?.currency ?? "INR",
      paidOrders: paid.length,
      openTickets: tickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length,
      csat: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      ratings: ratings.length,
    },
  };
}
