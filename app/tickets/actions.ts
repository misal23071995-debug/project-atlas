"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  addActivity,
  addMessage,
  addNote,
  createTicket,
  updateTicket,
  type NewTicket,
} from "@/app/lib/db/tickets";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/app/lib/tickets";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { analyzeWithAI } from "@/app/lib/ai/service";
import { emailAgentReply, emailSurveyIfDue } from "@/app/lib/db/email";

// This site's address, for links in emails (the survey page)
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

// Every action checks the signed-in agent and their role itself; the proxy alone isn't enough.
// Data calls pass the agent's current workspace, so nobody can touch another company's tickets.

function requireText(value: unknown, field: string, max = 5000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim().slice(0, max);
}

export async function createTicketAction(input: NewTicket) {
  const { org } = await requireSession("tickets.work");
  const confidence = Math.max(0, Math.min(100, Math.round(Number(input.confidence) || 0)));

  const id = await createTicket(org.id, {
    customerName: requireText(input.customerName, "Customer name", 200),
    customerEmail: requireText(input.customerEmail, "Customer email", 320),
    subject: requireText(input.subject, "Subject", 300),
    description: requireText(input.description, "Description"),
    summary: String(input.summary ?? "").slice(0, 1000),
    intent: String(input.intent ?? "General Support").slice(0, 100),
    sentiment: String(input.sentiment ?? "Neutral").slice(0, 50),
    confidence,
    priority: TICKET_PRIORITIES.includes(input.priority) ? input.priority : "Medium",
    channel: String(input.channel ?? "Chat").slice(0, 50),
    category: String(input.category ?? "General Support").slice(0, 100),
    tags: Array.isArray(input.tags) ? input.tags.map(String).slice(0, 20) : [],
  });

  revalidatePath("/tickets");
  return id;
}

export interface NewTicketFormState {
  error?: string;
}

// Ticket logged by hand from the New Ticket form (phone call, walk-in, forwarded email...)
export async function createManualTicketAction(
  _previous: NewTicketFormState,
  formData: FormData
): Promise<NewTicketFormState> {
  const { agent, org } = await requireSession("tickets.work");
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const customerEmail = field("customerEmail");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return { error: "Enter a valid customer email." };
  }

  let id: string;
  try {
    const description = requireText(field("description"), "Description");
    // The AI fills in summary, intent and sentiment; it falls back to rules if Gemini is unavailable
    const { analysis } = await analyzeWithAI(description);
    const priority = field("priority") as TicketPriority;

    id = await createTicketAction({
      customerName: requireText(field("customerName"), "Customer name", 200),
      customerEmail,
      subject: requireText(field("subject"), "Subject", 300),
      description,
      summary: analysis.summary,
      intent: analysis.intent,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      priority: TICKET_PRIORITIES.includes(priority) ? priority : "Medium",
      channel: field("channel") || "Phone",
      category: analysis.intent,
      tags: [analysis.intent],
    });

    await addActivity(org.id, id, `Logged by ${agent.name}`, "bg-green-500");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the ticket." };
  }

  redirect(`/tickets/${id}`);
}

export async function sendReplyAction(ticketId: string, message: string) {
  const { agent, org } = await requireSession("tickets.work");
  const text = requireText(message, "Reply");

  const messageId = await addMessage(org.id, ticketId, { sender: agent.name, role: "agent", message: text });
  // On email tickets the reply also goes to the customer's inbox
  const email = await emailAgentReply(org.id, org.name, ticketId, messageId, text);
  await addActivity(
    org.id,
    ticketId,
    email?.status === "sent" ? `Reply emailed by ${agent.name}` : `Reply sent by ${agent.name}`,
    "bg-indigo-500"
  );

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function addNoteAction(ticketId: string, note: string) {
  const { agent, org } = await requireSession("tickets.note");

  await addNote(org.id, ticketId, agent.name, requireText(note, "Note"));
  await addActivity(org.id, ticketId, `Note added by ${agent.name}`, "bg-zinc-500");

  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateStatusAction(ticketId: string, status: TicketStatus) {
  const { agent, org } = await requireSession("tickets.work");
  if (!TICKET_STATUSES.includes(status)) throw new Error("Invalid status");

  await updateTicket(org.id, ticketId, { status });
  await addActivity(org.id, ticketId, `Status changed to ${status} by ${agent.name}`, "bg-blue-500");
  if (status === "Resolved") await emailSurveyIfDue(org.id, org.name, ticketId, await siteOrigin());

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function updatePriorityAction(ticketId: string, priority: TicketPriority) {
  const { agent, org } = await requireSession("tickets.work");
  if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Invalid priority");

  await updateTicket(org.id, ticketId, { priority });
  await addActivity(org.id, ticketId, `Priority changed to ${priority} by ${agent.name}`, "bg-orange-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function assignTicketAction(ticketId: string, assignedTo: string) {
  const { agent, org } = await requireSession("tickets.work");
  const assignee = requireText(assignedTo, "Agent", 100);
  // Only people in this workspace who can work tickets
  const agentNames = (await listMembers(org.id)).filter((m) => m.role !== "qa").map((m) => m.name);
  if (assignee !== "Unassigned" && !agentNames.includes(assignee)) {
    throw new Error("Choose an agent from the list");
  }

  await updateTicket(org.id, ticketId, { assignedTo: assignee });
  await addActivity(org.id, ticketId, `Assigned to ${assignee} by ${agent.name}`, "bg-purple-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}
