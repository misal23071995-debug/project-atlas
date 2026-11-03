// SLA targets and clocks. Safe to import from Client Components.
// Times are calendar time (24/7), not business hours.

import { TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from "./tickets";

export interface SlaTarget {
  firstResponseMinutes: number;
  resolutionMinutes: number;
}

export type SlaTargets = Record<TicketPriority, SlaTarget>;

// Keep in sync with the backfill in supabase/migrations/011_sla.sql
export const DEFAULT_SLA_TARGETS: SlaTargets = {
  Urgent: { firstResponseMinutes: 15, resolutionMinutes: 4 * 60 },
  High: { firstResponseMinutes: 60, resolutionMinutes: 8 * 60 },
  Medium: { firstResponseMinutes: 4 * 60, resolutionMinutes: 24 * 60 },
  Low: { firstResponseMinutes: 8 * 60, resolutionMinutes: 72 * 60 },
};

export const MAX_FIRST_RESPONSE_MINUTES = 30 * 24 * 60;
export const MAX_RESOLUTION_MINUTES = 90 * 24 * 60;

const DONE_STATUSES: TicketStatus[] = ["Resolved", "Closed"];
// A clock is "at risk" once less than this share of its time is left
const AT_RISK_SHARE = 0.25;

export function isDone(status: TicketStatus) {
  return DONE_STATUSES.includes(status);
}

// The SLA fields every ticket carries
export interface TicketSla {
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  slaPausedAt: string | null;
  slaPausedMinutes: number;
}

export function dueTimes(createdAt: string, target: SlaTarget, pausedMinutes = 0) {
  const created = Date.parse(createdAt);
  return {
    firstResponseDueAt: new Date(created + target.firstResponseMinutes * 60000).toISOString(),
    resolutionDueAt: new Date(created + (target.resolutionMinutes + pausedMinutes) * 60000).toISOString(),
  };
}

export type ClockState = "running" | "at_risk" | "breached" | "paused" | "met" | "missed";

export interface Clock {
  state: ClockState;
  dueAt: string;
  // When it stopped: the reply or resolution time
  doneAt: string | null;
  // Minutes until due (negative once overdue); for met/missed, how early or late it finished
  minutesLeft: number;
}

function clock(
  startedAt: string,
  dueAt: string | null,
  doneAt: string | null,
  now: number,
  pausedAt: string | null = null
): Clock | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);

  if (doneAt) {
    const minutesLeft = (due - Date.parse(doneAt)) / 60000;
    return { state: minutesLeft >= 0 ? "met" : "missed", dueAt, doneAt, minutesLeft };
  }

  // While paused the due time moves forward, so count from when the pause began
  const reference = pausedAt ? Date.parse(pausedAt) : now;
  const minutesLeft = (due - reference) / 60000;
  const total = Math.max(1, (due - Date.parse(startedAt)) / 60000);

  const state: ClockState =
    minutesLeft < 0 ? "breached" : pausedAt ? "paused" : minutesLeft < total * AT_RISK_SHARE ? "at_risk" : "running";
  return { state, dueAt, doneAt: null, minutesLeft };
}

export function firstResponseClock(ticket: TicketSla, now: number) {
  // A ticket resolved without a reply has no first response to wait for
  if (!ticket.firstResponseAt && isDone(ticket.status)) return null;
  return clock(ticket.createdAt, ticket.firstResponseDueAt, ticket.firstResponseAt, now);
}

export function resolutionClock(ticket: TicketSla, now: number) {
  const doneAt = isDone(ticket.status) ? ticket.resolvedAt ?? ticket.createdAt : null;
  return clock(ticket.createdAt, ticket.resolutionDueAt, doneAt, now, ticket.slaPausedAt);
}

// The one clock to show in a list: the reply clock until someone replies, then the resolution clock
export function currentClock(ticket: TicketSla, now: number) {
  if (!isDone(ticket.status) && !ticket.firstResponseAt) {
    return { kind: "reply" as const, clock: firstResponseClock(ticket, now) };
  }
  return { kind: "resolve" as const, clock: resolutionClock(ticket, now) };
}

// Worst first, for sorting a queue by urgency
export const CLOCK_ORDER: Record<ClockState, number> = {
  breached: 0,
  at_risk: 1,
  running: 2,
  paused: 3,
  missed: 4,
  met: 5,
};

export function isBreached(ticket: TicketSla, now: number) {
  if (isDone(ticket.status)) return false;
  return (
    firstResponseClock(ticket, now)?.state === "breached" || resolutionClock(ticket, now)?.state === "breached"
  );
}

export function isAtRisk(ticket: TicketSla, now: number) {
  if (isDone(ticket.status) || isBreached(ticket, now)) return false;
  return currentClock(ticket, now).clock?.state === "at_risk";
}

export function formatMinutes(minutes: number) {
  const m = Math.abs(minutes);
  if (m < 1) return "< 1m";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 24 * 60) {
    const rest = Math.round(m % 60);
    return rest ? `${Math.floor(m / 60)}h ${rest}m` : `${Math.floor(m / 60)}h`;
  }
  const hours = Math.floor((m % (24 * 60)) / 60);
  return hours ? `${Math.floor(m / (24 * 60))}d ${hours}h` : `${Math.floor(m / (24 * 60))}d`;
}

// Short text for a list badge, e.g. "Reply in 40m", "Resolve overdue 2h"
export function clockLabel(kind: "reply" | "resolve", c: Clock) {
  const verb = kind === "reply" ? "Reply" : "Resolve";
  switch (c.state) {
    case "breached":
      return `${verb} overdue ${formatMinutes(c.minutesLeft)}`;
    case "paused":
      return `Paused · ${formatMinutes(c.minutesLeft)} left`;
    case "met":
      return "SLA met";
    case "missed":
      return "SLA missed";
    default:
      return `${verb} in ${formatMinutes(c.minutesLeft)}`;
  }
}

export const CLOCK_STYLES: Record<ClockState, string> = {
  running: "bg-emerald-500/15 text-emerald-400",
  at_risk: "bg-amber-500/15 text-amber-400",
  breached: "bg-rose-500/15 text-rose-400",
  paused: "bg-zinc-500/20 text-zinc-300",
  met: "bg-emerald-500/10 text-emerald-500",
  missed: "bg-rose-500/10 text-rose-500",
};

// Parses "15m", "4h", "1h 30m", "3d" or a bare number of minutes. Null if it can't.
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase();
  if (/^\d+$/.test(value)) return Number(value);

  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)\s*(d|h|m)/g)];
  if (!parts.length || parts.map((p) => p[0]).join("").replace(/\s/g, "") !== value.replace(/\s/g, "")) {
    return null;
  }

  const unit = { d: 24 * 60, h: 60, m: 1 } as const;
  const minutes = parts.reduce((sum, p) => sum + Number(p[1]) * unit[p[2] as keyof typeof unit], 0);
  return Math.round(minutes);
}

export function sortedPriorities() {
  return [...TICKET_PRIORITIES].reverse();
}
