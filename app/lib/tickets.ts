export type TicketStatus =
  | "Open"
  | "In Progress"
  | "Resolved";

export type TicketPriority =
  | "Low"
  | "Medium"
  | "High";

export interface Ticket {
  id: string;

  subject: string;

  description: string;

  summary: string;

  intent: string;

  priority: TicketPriority;

  status: TicketStatus;

  customerName: string;

  createdAt: string;
}