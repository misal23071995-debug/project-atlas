import type { Attachment } from "./attachments";

// Keep in sync with the check constraints in supabase/schema.sql
export const TICKET_STATUSES = [
  "Open",
  "Pending",
  "Waiting on Customer",
  "Escalated",
  "Resolved",
  "Closed",
] as const;
export const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Customer {
  id: string;

  name: string;

  email: string;

  location: string;

  device: string;

  orders: number;

  csat: number | null;

  // ISO timestamp
  customerSince: string;
}

export interface ConversationMessage {
  id?: string;

  sender: string;

  role: "customer" | "agent";

  message: string;

  // ISO timestamp
  time: string;

  // For replies on email tickets: whether the email went out
  delivery?: "sent" | "not_sent" | "failed" | null;

  deliveryNote?: string | null;
}

export interface TicketActivity {
  title: string;

  color: string;

  // ISO timestamp
  time: string;
}

export interface TicketNote {
  author: string;

  body: string;

  // ISO timestamp
  time: string;
}

export interface Ticket {
  id: string;

  subject: string;

  description: string;

  summary: string;

  intent: string;

  sentiment: string;

  confidence: number;

  priority: TicketPriority;

  status: TicketStatus;

  assignedTo: string;

  // ISO timestamp
  createdAt: string;

  category: string;

  channel: string;

  tags: string[];

  customer: Customer;

  // SLA: ISO timestamps, null until they happen (or before migration 011 set due times)
  firstResponseAt: string | null;

  resolvedAt: string | null;

  firstResponseDueAt: string | null;

  resolutionDueAt: string | null;

  // Set while the ticket is Waiting on Customer, which stops the resolution clock
  slaPausedAt: string | null;

  slaPausedMinutes: number;

  // Customer satisfaction from the ticket's survey link (1-5), null until they rate it
  csatRating: number | null;

  csatComment: string | null;

  csatRatedAt: string | null;
}

export interface TicketDetail extends Ticket {
  // Private key in the customer's survey link
  csatToken: string;

  conversation: ConversationMessage[];

  activities: TicketActivity[];

  notes: TicketNote[];

  attachments: Attachment[];
}

// Fixed locale and time zone so server and browser render the same text
const TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "Asia/Kolkata";

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
