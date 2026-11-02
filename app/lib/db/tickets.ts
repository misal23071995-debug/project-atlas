import "server-only";
import { getSupabase } from "./supabase";
import type {
  ConversationMessage,
  Customer,
  Ticket,
  TicketActivity,
  TicketDetail,
  TicketPriority,
  TicketStatus,
} from "@/app/lib/tickets";

const TICKET_COLUMNS = `
  id, subject, description, summary, intent, sentiment, confidence,
  priority, status, assigned_to, channel, category, tags, created_at,
  customer:customers (id, name, email, location, device, orders, csat, created_at)
`;

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

type TicketRow = {
  id: number;
  subject: string;
  description: string;
  summary: string;
  intent: string;
  sentiment: string;
  confidence: number;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string;
  channel: string;
  category: string;
  tags: string[];
  created_at: string;
  customer: CustomerRow;
};

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

function toTicket(row: TicketRow): Ticket {
  return {
    id: String(row.id),
    subject: row.subject,
    description: row.description,
    summary: row.summary,
    intent: row.intent,
    sentiment: row.sentiment,
    confidence: row.confidence,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    category: row.category,
    channel: row.channel,
    tags: row.tags,
    customer: toCustomer(row.customer),
  };
}

export async function listTickets(): Promise<Ticket[]> {
  const { data, error } = await getSupabase()
    .from("tickets")
    .select(TICKET_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<TicketRow[]>();

  if (error) throw new Error(`Failed to load tickets: ${error.message}`);
  return data.map(toTicket);
}

export async function getTicket(id: string): Promise<TicketDetail | null> {
  if (!/^\d+$/.test(id)) return null;

  const supabase = getSupabase();

  const [ticketRes, messagesRes, activitiesRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(TICKET_COLUMNS)
      .eq("id", id)
      .returns<TicketRow[]>()
      .maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("sender, role, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ticket_activities")
      .select("title, color, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (ticketRes.error) throw new Error(`Failed to load ticket: ${ticketRes.error.message}`);
  if (messagesRes.error) throw new Error(`Failed to load messages: ${messagesRes.error.message}`);
  if (activitiesRes.error) throw new Error(`Failed to load activity: ${activitiesRes.error.message}`);
  if (!ticketRes.data) return null;

  const conversation: ConversationMessage[] = messagesRes.data.map((m) => ({
    sender: m.sender,
    role: m.role,
    message: m.body,
    time: m.created_at,
  }));

  const activities: TicketActivity[] = activitiesRes.data.map((a) => ({
    title: a.title,
    color: a.color,
    time: a.created_at,
  }));

  return { ...toTicket(ticketRes.data), conversation, activities };
}

export type NewTicket = {
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  summary: string;
  intent: string;
  sentiment: string;
  confidence: number;
  priority: TicketPriority;
  channel: string;
  category: string;
  tags: string[];
};

export async function createTicket(input: NewTicket): Promise<string> {
  const supabase = getSupabase();

  // One customer per email, so the same person is recognised across channels
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      { name: input.customerName, email: input.customerEmail.toLowerCase() },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (customerError) throw new Error(`Failed to save customer: ${customerError.message}`);

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      customer_id: customer.id,
      subject: input.subject,
      description: input.description,
      summary: input.summary,
      intent: input.intent,
      sentiment: input.sentiment,
      confidence: input.confidence,
      priority: input.priority,
      channel: input.channel,
      category: input.category,
      tags: input.tags,
    })
    .select("id")
    .single();

  if (ticketError) throw new Error(`Failed to create ticket: ${ticketError.message}`);

  const ticketId = ticket.id as number;

  const [messageRes, activityRes] = await Promise.all([
    supabase.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender: input.customerName,
      role: "customer",
      body: input.description,
    }),
    supabase.from("ticket_activities").insert({
      ticket_id: ticketId,
      title: `Ticket Created via ${input.channel}`,
      color: "bg-green-500",
    }),
  ]);

  if (messageRes.error) throw new Error(`Failed to save message: ${messageRes.error.message}`);
  if (activityRes.error) throw new Error(`Failed to save activity: ${activityRes.error.message}`);

  return String(ticketId);
}

export async function addMessage(
  ticketId: string,
  message: Omit<ConversationMessage, "time">
) {
  const supabase = getSupabase();

  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    sender: message.sender,
    role: message.role,
    body: message.message,
  });
  if (error) throw new Error(`Failed to save message: ${error.message}`);

  await touchTicket(ticketId);
}

export async function addActivity(ticketId: string, title: string, color: string) {
  const { error } = await getSupabase()
    .from("ticket_activities")
    .insert({ ticket_id: ticketId, title, color });

  if (error) throw new Error(`Failed to save activity: ${error.message}`);
}

export async function updateTicket(
  ticketId: string,
  changes: Partial<{ status: TicketStatus; priority: TicketPriority; assignedTo: string }>
) {
  const { error } = await getSupabase()
    .from("tickets")
    .update({
      ...(changes.status && { status: changes.status }),
      ...(changes.priority && { priority: changes.priority }),
      ...(changes.assignedTo && { assigned_to: changes.assignedTo }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}

async function touchTicket(ticketId: string) {
  const { error } = await getSupabase()
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}
