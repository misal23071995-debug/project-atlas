import type { TicketPriority, TicketStatus } from "@/app/lib/tickets";

// One look for status, priority and channel everywhere a ticket appears

const STATUS_STYLES: Record<TicketStatus, string> = {
  Open: "bg-sky-500/10 text-sky-700 ring-sky-500/25",
  Pending: "bg-amber-500/10 text-amber-700 ring-amber-500/25",
  "Waiting on Customer": "bg-zinc-500/15 text-zinc-700 ring-zinc-500/25",
  Escalated: "bg-rose-500/10 text-rose-700 ring-rose-500/25",
  Resolved: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25",
  Closed: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20",
};

const PRIORITY_STYLES: Record<TicketPriority, { dot: string; text: string }> = {
  Urgent: { dot: "bg-rose-400", text: "text-rose-700" },
  High: { dot: "bg-orange-400", text: "text-orange-700" },
  Medium: { dot: "bg-amber-300", text: "text-zinc-800" },
  Low: { dot: "bg-zinc-400", text: "text-zinc-600" },
};

const base = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`${base} ${STATUS_STYLES[status as TicketStatus] ?? STATUS_STYLES.Open}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLES[priority as TicketPriority] ?? PRIORITY_STYLES.Medium;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${style.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {priority}
    </span>
  );
}

const CHANNEL_ICONS: Record<string, string> = {
  Email: "M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25zm1 .5 8 5.25 8-5.25",
  Chat: "M4 5h16v10H9l-5 4z",
  "AI Chatbot": "M9 3h6M12 3v3m-6 3h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m3 4h.01M15 13h.01",
  Phone: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  Social: "M7 10a3 3 0 1 0 0 4m10-8a3 3 0 1 0 0 .01M17 18a3 3 0 1 0 0 .01M9.6 13.3l4.8 2.8m0-8.2-4.8 2.8",
};

export function ChannelLabel({ channel }: { channel: string }) {
  const icon = CHANNEL_ICONS[channel] ?? CHANNEL_ICONS.Chat;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-700">
      <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon} />
      </svg>
      {channel}
    </span>
  );
}
