export type TicketStatus =
  | "Open"
  | "In Progress"
  | "Resolved";

export type TicketPriority =
  | "Low"
  | "Medium"
  | "High";

export interface ConversationMessage {
  sender: string;

  role: "customer" | "agent";

  message: string;

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

  customerName: string;

  email: string;

  createdAt: string;

  category: string;

  channel: string;

  tags: string[];

  conversation: ConversationMessage[];
}