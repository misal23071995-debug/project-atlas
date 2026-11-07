"use client";

import { useNow } from "@/app/components/useNow";
import { ChannelLabel } from "@/app/components/ui/Badges";
import { CLOCK_STYLES, firstResponseClock, formatMinutes, resolutionClock, type Clock } from "@/app/lib/sla";
import { TICKET_PRIORITIES, TICKET_STATUSES, formatDateTime, type TicketDetail } from "@/app/lib/tickets";

const field = "mt-1 h-9 w-full rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 disabled:bg-zinc-50 disabled:text-zinc-500";
const label = "block text-xs font-medium text-zinc-500";

const STATE_LABELS: Record<Clock["state"], string> = {
  running: "On track",
  at_risk: "At risk",
  breached: "Breached",
  paused: "Paused",
  met: "Met",
  missed: "Missed",
};

function SlaRow({ name, clock, now }: { name: string; clock: Clock | null; now: number | null }) {
  const detail = !clock
    ? "Not tracked"
    : clock.state === "met" || clock.state === "missed"
      ? `${formatMinutes(clock.minutesLeft)} ${clock.state === "met" ? "early" : "late"}`
      : clock.state === "breached"
        ? `${formatMinutes(clock.minutesLeft)} overdue`
        : clock.state === "paused"
          ? `${formatMinutes(clock.minutesLeft)} left, paused`
          : `due in ${formatMinutes(clock.minutesLeft)}`;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-sm text-zinc-800">{name}</p>
        <p className="text-xs text-zinc-500" title={clock ? `Due ${formatDateTime(clock.dueAt)}` : undefined}>
          {now === null && clock ? "…" : detail}
        </p>
      </div>
      {clock && now !== null && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset ${CLOCK_STYLES[clock.state]}`}>
          {STATE_LABELS[clock.state]}
        </span>
      )}
    </div>
  );
}

export default function PropertiesPanel({
  ticket,
  agentNames,
  readOnly,
  onStatus,
  onPriority,
  onAssign,
}: {
  ticket: TicketDetail;
  agentNames: string[];
  readOnly: boolean;
  onStatus: (value: string) => void;
  onPriority: (value: string) => void;
  onAssign: (value: string) => void;
}) {
  const now = useNow();
  const at = now ?? Date.parse(ticket.createdAt);
  // Keep an older assignee visible even if that name has no account
  const assignees = ["Unassigned", ...agentNames];
  if (!assignees.includes(ticket.assignedTo)) assignees.push(ticket.assignedTo);

  return (
    <div className="space-y-6 p-4">
      <section className="space-y-3.5">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-zinc-500">Ticket</h2>
        <label className={label}>
          Assignee
          <select value={ticket.assignedTo} onChange={(e) => onAssign(e.target.value)} disabled={readOnly} className={field}>
            {assignees.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Status
          <select value={ticket.status} onChange={(e) => onStatus(e.target.value)} disabled={readOnly} className={field}>
            {TICKET_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Priority
          <select value={ticket.priority} onChange={(e) => onPriority(e.target.value)} disabled={readOnly} className={field}>
            {[...TICKET_PRIORITIES].reverse().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <dl className="space-y-2 pt-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Channel</dt>
            <dd>
              <ChannelLabel channel={ticket.channel} />
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Category</dt>
            <dd className="truncate text-right text-zinc-800">{ticket.category}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Sentiment</dt>
            <dd className="text-zinc-800">{ticket.sentiment}</dd>
          </div>
        </dl>
        {ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ticket.tags.map((t) => (
              <span key={t} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                {t}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-zinc-500">SLA</h2>
        <div className="divide-y divide-zinc-100">
          <SlaRow name="First reply" clock={firstResponseClock(ticket, at)} now={now} />
          <SlaRow name="Resolution" clock={resolutionClock(ticket, at)} now={now} />
        </div>
      </section>

      <section className="space-y-1 text-xs text-zinc-500">
        <p>Opened {formatDateTime(ticket.createdAt)}</p>
        {ticket.firstResponseAt && <p>First reply {formatDateTime(ticket.firstResponseAt)}</p>}
        {ticket.resolvedAt && <p>Resolved {formatDateTime(ticket.resolvedAt)}</p>}
      </section>
    </div>
  );
}
