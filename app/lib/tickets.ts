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
  sender: string;

  role: "customer" | "agent";

  message: string;

  // ISO timestamp
  time: string;
}

export interface TicketActivity {
  title: string;

  color: string;

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
}

export interface TicketDetail extends Ticket {
  conversation: ConversationMessage[];

  activities: TicketActivity[];
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
