"use client";

import { useNow } from "@/app/components/useNow";
import {
  CLOCK_STYLES,
  firstResponseClock,
  formatMinutes,
  resolutionClock,
  type Clock,
  type TicketSla,
} from "@/app/lib/sla";
import { formatDateTime } from "@/app/lib/tickets";

const STATE_LABELS: Record<Clock["state"], string> = {
  running: "On track",
  at_risk: "At risk",
  breached: "Breached",
  paused: "Paused",
  met: "Met",
  missed: "Missed",
};

function detail(c: Clock) {
  switch (c.state) {
    case "met":
      return `Done ${formatDateTime(c.doneAt!)}, ${formatMinutes(c.minutesLeft)} early`;
    case "missed":
      return `Done ${formatDateTime(c.doneAt!)}, ${formatMinutes(c.minutesLeft)} late`;
    case "breached":
      return `Was due ${formatDateTime(c.dueAt)}, ${formatMinutes(c.minutesLeft)} ago`;
    case "paused":
      return `Waiting on the customer · ${formatMinutes(c.minutesLeft)} left when it restarts`;
    default:
      return `Due ${formatDateTime(c.dueAt)}, in ${formatMinutes(c.minutesLeft)}`;
  }
}

function Row({ label, clock, now }: { label: string; clock: Clock | null; now: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">{label}</span>
        {clock && now !== null ? (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${CLOCK_STYLES[clock.state]}`}>
            {STATE_LABELS[clock.state]}
          </span>
        ) : (
          <span className="text-sm text-zinc-600">{clock ? "…" : "Not tracked"}</span>
        )}
      </div>
      {clock && now !== null && <p className="mt-1 text-xs text-zinc-400">{detail(clock)}</p>}
    </div>
  );
}

export default function SlaCard({ ticket }: { ticket: TicketSla }) {
  const now = useNow();
  // Before the clock starts on the browser, use the creation time so nothing is computed from the server's clock
  const at = now ?? Date.parse(ticket.createdAt);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-5 text-xl font-semibold">SLA</h2>
      <div className="space-y-4">
        <Row label="First reply" clock={firstResponseClock(ticket, at)} now={now} />
        <Row label="Resolution" clock={resolutionClock(ticket, at)} now={now} />
      </div>
    </div>
  );
}
