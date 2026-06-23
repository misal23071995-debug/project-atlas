export type TicketStatus = "Open" | "Pending" | "Resolved" | "Closed";
export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";

export type Ticket = {
  id: string;
  subject: string;
  customerName: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAgent: string;
  createdDate: string;
};

export const mockTickets: Ticket[] = [
  { id: "TKT-4821", subject: "Unable to log in on mobile app", customerName: "Emily Chen", status: "Open", priority: "High", assignedAgent: "Sarah K.", createdDate: "2026-06-23" },
  { id: "TKT-4820", subject: "Billing discrepancy for March invoice", customerName: "Marcus Johnson", status: "Pending", priority: "Medium", assignedAgent: "James L.", createdDate: "2026-06-23" },
  { id: "TKT-4819", subject: "Request for API rate limit increase", customerName: "Priya Sharma", status: "Open", priority: "Medium", assignedAgent: "Maria R.", createdDate: "2026-06-22" },
  { id: "TKT-4818", subject: "Two-factor authentication not sending codes", customerName: "David Okonkwo", status: "Open", priority: "Urgent", assignedAgent: "Sarah K.", createdDate: "2026-06-22" },
  { id: "TKT-4817", subject: "Export to CSV missing columns", customerName: "Lisa Nguyen", status: "Resolved", priority: "Low", assignedAgent: "James L.", createdDate: "2026-06-22" },
  { id: "TKT-4816", subject: "Account locked after password reset", customerName: "Robert Williams", status: "Open", priority: "High", assignedAgent: "Maria R.", createdDate: "2026-06-21" },
  { id: "TKT-4815", subject: "Feature request: dark mode for reports", customerName: "Anna Kowalski", status: "Resolved", priority: "Low", assignedAgent: "Sarah K.", createdDate: "2026-06-21" },
  { id: "TKT-4814", subject: "Webhook delivery failures since yesterday", customerName: "TechFlow Inc.", status: "Open", priority: "Urgent", assignedAgent: "James L.", createdDate: "2026-06-21" },
  { id: "TKT-4813", subject: "Cannot update billing address", customerName: "Sophie Martin", status: "Pending", priority: "Medium", assignedAgent: "Maria R.", createdDate: "2026-06-20" },
  { id: "TKT-4812", subject: "Duplicate charges on subscription renewal", customerName: "Kevin Patel", status: "Open", priority: "High", assignedAgent: "Sarah K.", createdDate: "2026-06-20" },
  { id: "TKT-4811", subject: "SSO integration with Okta failing", customerName: "Northwind Labs", status: "Pending", priority: "Urgent", assignedAgent: "James L.", createdDate: "2026-06-20" },
  { id: "TKT-4810", subject: "Dashboard widgets not loading", customerName: "Hannah Brooks", status: "Resolved", priority: "Medium", assignedAgent: "Maria R.", createdDate: "2026-06-19" },
  { id: "TKT-4809", subject: "Need to transfer account ownership", customerName: "Carlos Mendez", status: "Closed", priority: "Low", assignedAgent: "Sarah K.", createdDate: "2026-06-19" },
  { id: "TKT-4808", subject: "Email notifications not being received", customerName: "Rachel Green", status: "Open", priority: "Medium", assignedAgent: "James L.", createdDate: "2026-06-19" },
  { id: "TKT-4807", subject: "Refund request for cancelled plan", customerName: "Tom Anderson", status: "Pending", priority: "Medium", assignedAgent: "Maria R.", createdDate: "2026-06-18" },
  { id: "TKT-4806", subject: "Permission error when inviting team members", customerName: "BrightPath Co.", status: "Open", priority: "High", assignedAgent: "Sarah K.", createdDate: "2026-06-18" },
  { id: "TKT-4805", subject: "Slow page load on analytics tab", customerName: "Julia Fischer", status: "Resolved", priority: "Low", assignedAgent: "James L.", createdDate: "2026-06-18" },
  { id: "TKT-4804", subject: "Incorrect timezone on scheduled reports", customerName: "Akira Tanaka", status: "Closed", priority: "Low", assignedAgent: "Maria R.", createdDate: "2026-06-17" },
  { id: "TKT-4803", subject: "Data sync delay with Salesforce", customerName: "Summit Retail", status: "Open", priority: "High", assignedAgent: "James L.", createdDate: "2026-06-17" },
  { id: "TKT-4802", subject: "Cannot download invoice PDF", customerName: "Nina Volkov", status: "Resolved", priority: "Medium", assignedAgent: "Sarah K.", createdDate: "2026-06-17" },
  { id: "TKT-4801", subject: "Trial extension request", customerName: "Startup Hub LLC", status: "Pending", priority: "Low", assignedAgent: "Maria R.", createdDate: "2026-06-16" },
  { id: "TKT-4800", subject: "Custom domain SSL certificate error", customerName: "Blue Ocean Media", status: "Open", priority: "Urgent", assignedAgent: "James L.", createdDate: "2026-06-16" },
  { id: "TKT-4799", subject: "Bulk user import failing at row 847", customerName: "Global Edu Group", status: "Open", priority: "High", assignedAgent: "Sarah K.", createdDate: "2026-06-16" },
  { id: "TKT-4798", subject: "Question about enterprise pricing tiers", customerName: "Michael O'Brien", status: "Closed", priority: "Low", assignedAgent: "Maria R.", createdDate: "2026-06-15" },
  { id: "TKT-4797", subject: "Mobile push notifications delayed", customerName: "FitTrack App", status: "Resolved", priority: "Medium", assignedAgent: "James L.", createdDate: "2026-06-15" },
  { id: "TKT-4796", subject: "GDPR data export request", customerName: "Elena Rossi", status: "Pending", priority: "High", assignedAgent: "Sarah K.", createdDate: "2026-06-15" },
  { id: "TKT-4795", subject: "Integration guide documentation outdated", customerName: "DevCore Systems", status: "Closed", priority: "Low", assignedAgent: "Maria R.", createdDate: "2026-06-14" },
  { id: "TKT-4794", subject: "Session timeout too aggressive", customerName: "James Wilson", status: "Resolved", priority: "Medium", assignedAgent: "James L.", createdDate: "2026-06-14" },
  { id: "TKT-4793", subject: "Unable to cancel subscription online", customerName: "Samantha Lee", status: "Open", priority: "Medium", assignedAgent: "Sarah K.", createdDate: "2026-06-14" },
  { id: "TKT-4792", subject: "Audit log missing entries from June 10", customerName: "SecureVault Inc.", status: "Open", priority: "Urgent", assignedAgent: "James L.", createdDate: "2026-06-13" },
];

export const statusStyles: Record<TicketStatus, string> = {
  Open: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  Resolved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  Closed: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export const priorityStyles: Record<TicketPriority, string> = {
  Low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  Medium: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  High: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  Urgent: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
};

export function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
