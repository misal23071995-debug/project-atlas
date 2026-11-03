import "server-only";
import { getSupabase } from "./supabase";
import type {
  ConversationMessage,
  Customer,
  Ticket,
  TicketActivity,
  TicketDetail,
  TicketNote,
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

// Every function takes the workspace id and only touches that workspace's tickets

export async function listTickets(orgId: string): Promise<Ticket[]> {
  const { data, error } = await getSupabase()
    .from("tickets")
    .select(TICKET_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .returns<TicketRow[]>();

  if (error) throw new Error(`Failed to load tickets: ${error.message}`);
  return data.map(toTicket);
}

// Messages, activity and notes are read alongside, but only returned if the ticket is in this workspace
export async function getTicket(orgId: string, id: string): Promise<TicketDetail | null> {
  if (!/^\d+$/.test(id)) return null;

  const supabase = getSupabase();

  const [ticketRes, messagesRes, activitiesRes, notesRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(TICKET_COLUMNS)
      .eq("id", id)
      .eq("org_id", orgId)
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
    supabase
      .from("ticket_notes")
      .select("author, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketRes.error) throw new Error(`Failed to load ticket: ${ticketRes.error.message}`);
  if (messagesRes.error) throw new Error(`Failed to load messages: ${messagesRes.error.message}`);
  if (activitiesRes.error) throw new Error(`Failed to load activity: ${activitiesRes.error.message}`);
  // PGRST205: the ticket_notes table doesn't exist yet (migration 002 not run), so show no notes
  if (notesRes.error && notesRes.error.code !== "PGRST205") {
    throw new Error(`Failed to load notes: ${notesRes.error.message}`);
  }
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

  const notes: TicketNote[] = (notesRes.data ?? []).map((n) => ({
    author: n.author,
    body: n.body,
    time: n.created_at,
  }));

  return { ...toTicket(ticketRes.data), conversation, activities, notes };
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

export async function createTicket(orgId: string, input: NewTicket): Promise<string> {
  const supabase = getSupabase();

  // One customer per email in each workspace, so the same person is recognised across channels
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert(
      { org_id: orgId, name: input.customerName, email: input.customerEmail.toLowerCase() },
      { onConflict: "org_id,email", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (customerError) throw new Error(`Failed to save customer: ${customerError.message}`);

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      org_id: orgId,
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

// Throws unless the ticket exists in this workspace, so ids from another company are refused
async function assertTicket(orgId: string, ticketId: string) {
  if (!/^\d+$/.test(ticketId)) throw new Error("Ticket not found");

  const { data, error } = await getSupabase()
    .from("tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  if (!data) throw new Error("Ticket not found");
}

export async function addMessage(
  orgId: string,
  ticketId: string,
  message: Omit<ConversationMessage, "time">
) {
  await assertTicket(orgId, ticketId);
  const supabase = getSupabase();

  const { error } = await supabase.from("ticket_messages").insert({
    ticket_id: ticketId,
    sender: message.sender,
    role: message.role,
    body: message.message,
  });
  if (error) throw new Error(`Failed to save message: ${error.message}`);

  await touchTicket(orgId, ticketId);
}

export async function addNote(orgId: string, ticketId: string, author: string, body: string) {
  await assertTicket(orgId, ticketId);
  const { error } = await getSupabase()
    .from("ticket_notes")
    .insert({ ticket_id: ticketId, author, body });

  if (error) throw new Error(`Failed to save note: ${error.message}`);
}

export async function addActivity(orgId: string, ticketId: string, title: string, color: string) {
  await assertTicket(orgId, ticketId);
  const { error } = await getSupabase()
    .from("ticket_activities")
    .insert({ ticket_id: ticketId, title, color });

  if (error) throw new Error(`Failed to save activity: ${error.message}`);
}

export async function updateTicket(
  orgId: string,
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
    .eq("id", ticketId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}

async function touchTicket(orgId: string, ticketId: string) {
  const { error } = await getSupabase()
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}
