"use client";

import { useNow } from "@/app/components/useNow";
import { CLOCK_STYLES, clockLabel, currentClock, type TicketSla } from "@/app/lib/sla";
import { formatDateTime } from "@/app/lib/tickets";

// The clock that matters right now for a ticket in a list: reply, then resolve
export default function SlaBadge({ ticket }: { ticket: TicketSla }) {
  const now = useNow();
  if (now === null) return <span className="text-xs text-zinc-600">…</span>;

  const { kind, clock } = currentClock(ticket, now);
  if (!clock) return <span className="text-xs text-zinc-600">—</span>;

  return (
    <span
      title={`Due ${formatDateTime(clock.dueAt)}`}
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CLOCK_STYLES[clock.state]}`}
    >
      {clockLabel(kind, clock)}
    </span>
  );
}
