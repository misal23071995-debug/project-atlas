import type { Ticket } from "./tickets";

const tickets: Ticket[] = [];

export function getTickets() {
  return tickets;
}

export function createTicket(ticket: Ticket) {
  tickets.unshift(ticket);
}