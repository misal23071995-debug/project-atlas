"use server";

import { revalidatePath } from "next/cache";
import {
  addActivity,
  addMessage,
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
import { requireAgent } from "@/app/lib/auth/session";

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

  await updateTicket(ticketId, { assignedTo: assignee });
  await addActivity(ticketId, `Assigned to ${assignee} by ${agent.name}`, "bg-purple-500");

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}
