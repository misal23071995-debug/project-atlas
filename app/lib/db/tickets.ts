import "server-only";
import { getSupabase } from "./supabase";
import { getSlaTargets } from "./sla";
import { DEFAULT_SLA_TARGETS, dueTimes, isDone } from "@/app/lib/sla";
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
  first_response_at, resolved_at, first_response_due_at, resolution_due_at, sla_paused_at, sla_paused_minutes,
  csat_rating, csat_comment, csat_rated_at,
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
  first_response_at: string | null;
  resolved_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_minutes: number;
  csat_rating: number | null;
  csat_comment: string | null;
  csat_rated_at: string | null;
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
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at,
    firstResponseDueAt: row.first_response_due_at,
    resolutionDueAt: row.resolution_due_at,
    slaPausedAt: row.sla_paused_at,
    slaPausedMinutes: row.sla_paused_minutes ?? 0,
    csatRating: row.csat_rating,
    csatComment: row.csat_comment,
    csatRatedAt: row.csat_rated_at,
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
      .select(`${TICKET_COLUMNS}, csat_token`)
      .eq("id", id)
      .eq("org_id", orgId)
      .returns<(TicketRow & { csat_token: string })[]>()
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

  return { ...toTicket(ticketRes.data), csatToken: ticketRes.data.csat_token, conversation, activities, notes };
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

  // The due times are fixed when the ticket is created, so later changes to the targets don't rewrite history
  const targets = (await getSlaTargets(orgId)) ?? DEFAULT_SLA_TARGETS;
  const due = dueTimes(new Date().toISOString(), targets[input.priority]);

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
      first_response_due_at: due.firstResponseDueAt,
      resolution_due_at: due.resolutionDueAt,
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
  // The first agent reply stops the first-response clock
  if (message.role === "agent") {
    const { error: stampError } = await supabase
      .from("tickets")
      .update({ first_response_at: new Date().toISOString() })
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .is("first_response_at", null);
    if (stampError) throw new Error(`Failed to update ticket: ${stampError.message}`);
  }
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

type SlaStateRow = {
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  resolved_at: string | null;
  resolution_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_minutes: number;
};

export async function updateTicket(
  orgId: string,
  ticketId: string,
  changes: Partial<{ status: TicketStatus; priority: TicketPriority; assignedTo: string }>
) {
  const supabase = getSupabase();
  const now = new Date();
  const values: Record<string, unknown> = {
    ...(changes.status && { status: changes.status }),
    ...(changes.priority && { priority: changes.priority }),
    ...(changes.assignedTo && { assigned_to: changes.assignedTo }),
    updated_at: now.toISOString(),
  };

  // Status and priority changes move the SLA clocks, so read where they stand first
  if (changes.status || changes.priority) {
    const { data: current, error } = await supabase
      .from("tickets")
      .select("status, priority, created_at, resolved_at, resolution_due_at, sla_paused_at, sla_paused_minutes")
      .eq("id", ticketId)
      .eq("org_id", orgId)
      .returns<SlaStateRow[]>()
      .maybeSingle();

    if (error) throw new Error(`Failed to load ticket: ${error.message}`);
    if (!current) throw new Error("Ticket not found");
    Object.assign(values, slaChanges(current, changes, now));
    if (changes.priority && changes.priority !== current.priority) {
      // Due times follow the new priority, counted from when the ticket was created
      const targets = (await getSlaTargets(orgId)) ?? DEFAULT_SLA_TARGETS;
      const pausedMinutes = (values.sla_paused_minutes as number | undefined) ?? current.sla_paused_minutes;
      const due = dueTimes(current.created_at, targets[changes.priority], pausedMinutes);
      values.first_response_due_at = due.firstResponseDueAt;
      values.resolution_due_at = due.resolutionDueAt;
    }
  }

  const { error } = await supabase.from("tickets").update(values).eq("id", ticketId).eq("org_id", orgId);
  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}

// Resolving stops the resolution clock, re-opening restarts it, and Waiting on Customer pauses it
function slaChanges(
  current: SlaStateRow,
  changes: Partial<{ status: TicketStatus }>,
  now: Date
): Record<string, unknown> {
  const status = changes.status;
  if (!status || status === current.status) return {};

  const values: Record<string, unknown> = {};

  if (isDone(status)) {
    if (!isDone(current.status) || !current.resolved_at) values.resolved_at = now.toISOString();
  } else if (isDone(current.status)) {
    values.resolved_at = null;
  }

  const pauses = status === "Waiting on Customer";
  if (pauses && !current.sla_paused_at) {
    values.sla_paused_at = now.toISOString();
  } else if (!pauses && current.sla_paused_at) {
    // The time spent waiting is added to the resolution due time
    const pausedFor = Math.max(0, Math.round((now.getTime() - Date.parse(current.sla_paused_at)) / 60000));
    values.sla_paused_at = null;
    values.sla_paused_minutes = current.sla_paused_minutes + pausedFor;
    if (current.resolution_due_at) {
      values.resolution_due_at = new Date(Date.parse(current.resolution_due_at) + pausedFor * 60000).toISOString();
    }
  }

  return values;
}

async function touchTicket(orgId: string, ticketId: string) {
  const { error } = await getSupabase()
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to update ticket: ${error.message}`);
}

// ---- Customer satisfaction survey (public, found by the private token in the link) ----

export interface SurveyTicket {
  ticketId: string;
  subject: string;
  customerName: string;
  workspaceName: string;
  rating: number | null;
  comment: string | null;
}

export async function getSurveyTicket(token: string): Promise<SurveyTicket | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;

  const { data, error } = await getSupabase()
    .from("tickets")
    .select("id, subject, csat_rating, csat_comment, customer:customers (name), org:organizations (name)")
    .eq("csat_token", token)
    .returns<
      { id: number; subject: string; csat_rating: number | null; csat_comment: string | null; customer: { name: string } | null; org: { name: string } | null }[]
    >()
    .maybeSingle();

  if (error) throw new Error(`Failed to load the survey: ${error.message}`);
  if (!data) return null;
  return {
    ticketId: String(data.id),
    subject: data.subject,
    customerName: data.customer?.name ?? "",
    workspaceName: data.org?.name ?? "Support",
    rating: data.csat_rating,
    comment: data.csat_comment,
  };
}

// The customer can change their answer; the latest one counts
export async function saveSurveyRating(token: string, rating: number, comment: string) {
  const { data, error } = await getSupabase()
    .from("tickets")
    .update({ csat_rating: rating, csat_comment: comment || null, csat_rated_at: new Date().toISOString() })
    .eq("csat_token", token)
    .select("id, org_id")
    .maybeSingle();

  if (error) throw new Error(`Failed to save your rating: ${error.message}`);
  if (!data) throw new Error("This survey link isn't valid.");

  const { error: activityError } = await getSupabase()
    .from("ticket_activities")
    .insert({ ticket_id: data.id, title: `Customer rated the support ${rating}/5`, color: rating >= 4 ? "bg-emerald-500" : "bg-rose-500" });
  if (activityError) throw new Error(`Failed to save activity: ${activityError.message}`);
}
