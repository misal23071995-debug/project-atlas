"use server";

import { revalidatePath } from "next/cache";
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
import { listAgents, requireAgent } from "@/app/lib/auth/session";
import { analyzeWithAI } from "@/app/lib/ai/service";

// Every action checks the signed-in agent itself; the proxy alone isn't enough

function requireText(value: unknown, field: string, max = 5000) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim().slice(0, max);
}

export async function createTicketAction(input: NewTicket) {
  await requireAgent();
  const confidence = Math.max(0, Math.min(100, Math.round(Number(input.confidence) || 0)));

  const id = await createTicket({
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
  const agent = await requireAgent();
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

    await addActivity(id, `Logged by ${agent.name}`, "bg-green-500");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the ticket." };
  }

  redirect(`/tickets/${id}`);
}

export async function sendReplyAction(ticketId: string, message: string) {
  const agent = await requireAgent();

  await addMessage(ticketId, {
    sender: agent.name,
    role: "agent",
    message: requireText(message, "Reply"),
  });
  await addActivity(ticketId, `Reply sent by ${agent.name}`, "bg-indigo-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function addNoteAction(ticketId: string, note: string) {
  const agent = await requireAgent();

  await addNote(ticketId, agent.name, requireText(note, "Note"));
  await addActivity(ticketId, `Note added by ${agent.name}`, "bg-zinc-500");

  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateStatusAction(ticketId: string, status: TicketStatus) {
  const agent = await requireAgent();
  if (!TICKET_STATUSES.includes(status)) throw new Error("Invalid status");

  await updateTicket(ticketId, { status });
  await addActivity(ticketId, `Status changed to ${status} by ${agent.name}`, "bg-blue-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function updatePriorityAction(ticketId: string, priority: TicketPriority) {
  const agent = await requireAgent();
  if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Invalid priority");

  await updateTicket(ticketId, { priority });
  await addActivity(ticketId, `Priority changed to ${priority} by ${agent.name}`, "bg-orange-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function assignTicketAction(ticketId: string, assignedTo: string) {
  const agent = await requireAgent();
  const assignee = requireText(assignedTo, "Agent", 100);
  const agentNames = (await listAgents()).map((a) => a.name);
  if (assignee !== "Unassigned" && !agentNames.includes(assignee)) {
    throw new Error("Choose an agent from the list");
  }

  await updateTicket(ticketId, { assignedTo: assignee });
  await addActivity(ticketId, `Assigned to ${assignee} by ${agent.name}`, "bg-purple-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}
