import "server-only";
import { getSupabase } from "./supabase";
import { listMembers } from "@/app/lib/auth/session";
import { HANDOFF_LABELS, type HandoffType } from "@/app/lib/bot/types";
import { firstResponseClock, isAtRisk, isBreached, isDone, resolutionClock, type TicketSla } from "@/app/lib/sla";
import { addDays, localDate, type Period } from "@/app/lib/reports/period";
import { SCORE_MAX, SCORE_MIN, type CriterionScore } from "@/app/lib/quality/types";
import { TICKET_PRIORITIES, type TicketPriority, type TicketStatus } from "@/app/lib/tickets";

// Reads the workspace's tickets and activity and summarises them in memory, like the dashboard.
// Fine for tens of thousands of tickets; move the counting into SQL if it grows far beyond that.

const PAGE_SIZE = 1000;
const MAX_ROWS = 50000;

export interface Summary {
  created: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  medianFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  medianResolutionMinutes: number | null;
  // Reply and resolution clocks that stopped in the period, and the share that stopped on time
  slaClocks: number;
  slaMetPercent: number | null;
  // Average chat rating, 1-5
  csatAverage: number | null;
  csatResponses: number;
}

export interface Report {
  generatedAt: number;
  summary: Summary;
  previous: Summary;
  // Right now, whatever the period
  backlog: { open: number; breached: number; atRisk: number; unassigned: number; oldestOpenMinutes: number | null };
  trend: { label: string; created: number; resolved: number }[];
  // "day" or "week", depending on how long the period is
  trendStep: "day" | "week";
  byChannel: { channel: string; created: number; resolved: number; avgFirstResponseMinutes: number | null; slaMetPercent: number | null }[];
  byCategory: { category: string; created: number; share: number; avgResolutionMinutes: number | null }[];
  byPriority: { priority: TicketPriority; created: number; open: number; replyMetPercent: number | null; resolveMetPercent: number | null }[];
  agents: {
    name: string;
    resolved: number;
    replies: number;
    openNow: number;
    avgFirstResponseMinutes: number | null;
    slaMetPercent: number | null;
    qcAverage: number | null;
    qcReviews: number;
    trainingPassed: number;
    trainingOverdue: number;
  }[];
  // Null when that module's migration hasn't been run
  quality: { reviews: number; average: number | null; byCriterion: { label: string; average: number }[] } | null;
  bot: {
    chats: number;
    resolvedByBot: number;
    handedOff: number;
    deflectionPercent: number | null;
    reasons: { reason: string; count: number }[];
  } | null;
  training: { open: number; passed: number; overdue: number; averageBestScore: number | null } | null;
}

type TicketRow = {
  id: number;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string;
  channel: string;
  category: string;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_minutes: number;
};

type ReplyRow = { ticket_id: number; sender: string; created_at: string };
type ReviewRow = { agent_name: string; total: number | null; scores: CriterionScore[] | null; reviewed_at: string | null };
type ChatRow = { status: string; handoff_type: HandoffType | null; csat_rating: number | null; rated_at: string | null; created_at: string };
type AssignmentRow = { user_id: string; status: string; due_date: string | null; passed_at: string | null; best_score: number | null };

// PostgREST returns at most 1000 rows per request, so page through
async function all<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string; message: string } | null }>
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; rows.length < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error?.code === "PGRST205") return null;
    if (error) throw new Error(`Failed to load report: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);
const round1 = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function toSla(t: TicketRow): TicketSla {
  return {
    priority: t.priority,
    status: t.status,
    createdAt: t.created_at,
    firstResponseAt: t.first_response_at,
    resolvedAt: t.resolved_at,
    firstResponseDueAt: t.first_response_due_at,
    resolutionDueAt: t.resolution_due_at,
    slaPausedAt: t.sla_paused_at,
    slaPausedMinutes: t.sla_paused_minutes ?? 0,
  };
}

const minutesBetween = (start: string, end: string) => Math.max(0, (Date.parse(end) - Date.parse(start)) / 60000);

// Everything about tickets in one window [from, to)
function measure(tickets: TicketRow[], chats: ChatRow[], from: number, to: number, now: number) {
  const inWindow = (iso: string | null) => iso !== null && Date.parse(iso) >= from && Date.parse(iso) < to;

  const created = tickets.filter((t) => inWindow(t.created_at));
  const resolved = tickets.filter((t) => isDone(t.status) && inWindow(t.resolved_at));
  const replied = tickets.filter((t) => inWindow(t.first_response_at));

  // Each clock counts in the window it stopped in
  const replyClocks = tickets
    .map((t) => ({ t, c: firstResponseClock(toSla(t), now) }))
    .filter(({ c }) => c?.doneAt && inWindow(c.doneAt));
  const resolveClocks = tickets
    .map((t) => ({ t, c: resolutionClock(toSla(t), now) }))
    .filter(({ c }) => c?.doneAt && inWindow(c.doneAt));

  const frt = replied.map((t) => minutesBetween(t.created_at, t.first_response_at!));
  const ttr = resolved.map((t) => minutesBetween(t.created_at, t.resolved_at!));
  const clocks = [...replyClocks, ...resolveClocks];
  const rated = chats.filter((c) => c.csat_rating !== null && inWindow(c.rated_at ?? c.created_at));

  const summary: Summary = {
    created: created.length,
    resolved: resolved.length,
    avgFirstResponseMinutes: mean(frt),
    medianFirstResponseMinutes: median(frt),
    avgResolutionMinutes: mean(ttr),
    medianResolutionMinutes: median(ttr),
    slaClocks: clocks.length,
    slaMetPercent: percent(clocks.filter(({ c }) => c!.state === "met").length, clocks.length),
    csatAverage: round1(mean(rated.map((c) => c.csat_rating!))),
    csatResponses: rated.length,
  };

  return { summary, created, resolved, replied, replyClocks, resolveClocks };
}

type Measured = ReturnType<typeof measure>;

function metPercent(clocks: Measured["replyClocks"]) {
  return percent(clocks.filter(({ c }) => c!.state === "met").length, clocks.length);
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function trend(m: Measured, period: Period) {
  const step = period.days > 45 ? "week" : "day";
  const size = step === "week" ? 7 : 1;
  const buckets: { start: string; label: string; created: number; resolved: number }[] = [];

  for (let date = period.fromDate; date <= period.toDate; date = addDays(date, size)) {
    const label = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
    buckets.push({ start: date, label: step === "week" ? `Week of ${label}` : label, created: 0, resolved: 0 });
  }

  const bucketFor = (iso: string) => {
    const date = localDate(Date.parse(iso), period.timezone);
    for (let i = buckets.length - 1; i >= 0; i--) if (date >= buckets[i].start) return buckets[i];
    return null;
  };
  for (const t of m.created) bucketFor(t.created_at)!.created += 1;
  for (const t of m.resolved) {
    const bucket = bucketFor(t.resolved_at!);
    if (bucket) bucket.resolved += 1;
  }

  return { step: step as "day" | "week", points: buckets.map(({ label, created, resolved }) => ({ label, created, resolved })) };
}

export async function getReport(orgId: string, period: Period): Promise<Report> {
  const supabase = getSupabase();
  const now = Date.now();
  const sinceIso = new Date(period.previousFrom).toISOString();
  const fromIso = new Date(period.from).toISOString();
  const toIso = new Date(period.to).toISOString();

  const [tickets, replies, reviews, chats, assignments, members] = await Promise.all([
    all<TicketRow>((a, b) =>
      supabase
        .from("tickets")
        .select(
          "id, priority, status, assigned_to, channel, category, created_at, first_response_at, resolved_at, first_response_due_at, resolution_due_at, sla_paused_at, sla_paused_minutes"
        )
        .eq("org_id", orgId)
        // Created since the previous period began, or still open, or resolved since then
        .or(`created_at.gte.${sinceIso},resolved_at.gte.${sinceIso},status.not.in.(Resolved,Closed)`)
        .order("id")
        .range(a, b)
    ),
    all<ReplyRow & { ticket: unknown }>((a, b) =>
      supabase
        .from("ticket_messages")
        // Inner join so only replies on this workspace's tickets come back
        .select("ticket_id, sender, created_at, ticket:tickets!inner (org_id)")
        .eq("role", "agent")
        .eq("ticket.org_id", orgId)
        .gte("created_at", fromIso)
        .lt("created_at", toIso)
        .order("created_at")
        .range(a, b)
    ),
    all<ReviewRow>((a, b) =>
      supabase
        .from("qa_reviews")
        .select("agent_name, total, scores, reviewed_at")
        .eq("org_id", orgId)
        .eq("status", "reviewed")
        .gte("reviewed_at", fromIso)
        .lt("reviewed_at", toIso)
        .order("reviewed_at")
        .range(a, b)
    ),
    all<ChatRow>((a, b) =>
      supabase
        .from("bot_conversations")
        .select("status, handoff_type, csat_rating, rated_at, created_at")
        .eq("org_id", orgId)
        .gt("customer_messages", 0)
        .gte("created_at", sinceIso)
        .lt("created_at", toIso)
        .order("created_at")
        .range(a, b)
    ),
    all<AssignmentRow>((a, b) =>
      supabase
        .from("course_assignments")
        .select("user_id, status, due_date, passed_at, best_score")
        .eq("org_id", orgId)
        .order("id")
        .range(a, b)
    ),
    listMembers(orgId),
  ]);

  if (!tickets || !replies) throw new Error("Failed to load report: tickets are missing");

  const current = measure(tickets, chats ?? [], period.from, period.to, now);
  const previous = measure(tickets, chats ?? [], period.previousFrom, period.from, now);
  const { step, points } = trend(current, period);

  // ---- Backlog right now ----
  const open = tickets.filter((t) => !isDone(t.status));
  const oldest = open.reduce<string | null>((min, t) => (min === null || t.created_at < min ? t.created_at : min), null);

  // ---- Channels, categories, priorities ----
  const replyClocksBy = (key: (t: TicketRow) => string) => groupBy(current.replyClocks, ({ t }) => key(t));
  const allClocksBy = (key: (t: TicketRow) => string) =>
    groupBy([...current.replyClocks, ...current.resolveClocks], ({ t }) => key(t));

  const channelClocks = allClocksBy((t) => t.channel);
  const channelReplied = groupBy(current.replied, (t) => t.channel);
  const channelResolved = groupBy(current.resolved, (t) => t.channel);
  const byChannel = [...groupBy(current.created, (t) => t.channel)]
    .map(([channel, list]) => ({
      channel,
      created: list.length,
      resolved: channelResolved.get(channel)?.length ?? 0,
      avgFirstResponseMinutes: mean((channelReplied.get(channel) ?? []).map((t) => minutesBetween(t.created_at, t.first_response_at!))),
      slaMetPercent: metPercent(channelClocks.get(channel) ?? []),
    }))
    .sort((a, b) => b.created - a.created);

  const categoryResolved = groupBy(current.resolved, (t) => t.category);
  const byCategory = [...groupBy(current.created, (t) => t.category)]
    .map(([category, list]) => ({
      category,
      created: list.length,
      share: percent(list.length, current.created.length) ?? 0,
      avgResolutionMinutes: mean((categoryResolved.get(category) ?? []).map((t) => minutesBetween(t.created_at, t.resolved_at!))),
    }))
    .sort((a, b) => b.created - a.created);

  const priorityReply = replyClocksBy((t) => t.priority);
  const priorityResolve = groupBy(current.resolveClocks, ({ t }) => t.priority);
  const byPriority = [...TICKET_PRIORITIES].reverse().map((priority) => ({
    priority,
    created: current.created.filter((t) => t.priority === priority).length,
    open: open.filter((t) => t.priority === priority).length,
    replyMetPercent: metPercent(priorityReply.get(priority) ?? []),
    resolveMetPercent: metPercent(priorityResolve.get(priority) ?? []),
  }));

  // ---- Agents ----
  // The first reply on a ticket belongs to whoever sent it, not whoever holds the ticket now
  const firstReplier = new Map<number, string>();
  for (const r of replies) if (!firstReplier.has(r.ticket_id)) firstReplier.set(r.ticket_id, r.sender);
  const today = localDate(now, period.timezone);
  const names = new Map(members.map((m) => [m.id, m.name]));

  const agentNames = new Set<string>([
    ...members.filter((m) => m.role !== "qa").map((m) => m.name),
    ...current.resolved.map((t) => t.assigned_to),
    ...replies.map((r) => r.sender),
    ...(reviews ?? []).map((r) => r.agent_name),
  ]);
  agentNames.delete("Unassigned");

  const clocksByAgent = allClocksBy((t) => t.assigned_to);
  const agents = [...agentNames]
    .map((name) => {
      const firstReplies = current.replied.filter((t) => (firstReplier.get(t.id) ?? t.assigned_to) === name);
      const qc = (reviews ?? []).filter((r) => r.agent_name === name && r.total !== null);
      const training = (assignments ?? []).filter((a) => names.get(a.user_id) === name);
      return {
        name,
        resolved: current.resolved.filter((t) => t.assigned_to === name).length,
        replies: replies.filter((r) => r.sender === name).length,
        openNow: open.filter((t) => t.assigned_to === name).length,
        avgFirstResponseMinutes: mean(firstReplies.map((t) => minutesBetween(t.created_at, t.first_response_at!))),
        slaMetPercent: metPercent(clocksByAgent.get(name) ?? []),
        qcAverage: qc.length ? Math.round(mean(qc.map((r) => r.total!))!) : null,
        qcReviews: qc.length,
        trainingPassed: training.filter((a) => a.passed_at && inPeriod(a.passed_at, period)).length,
        trainingOverdue: training.filter((a) => a.status !== "passed" && a.due_date !== null && a.due_date < today).length,
      };
    })
    .filter((a) => a.resolved || a.replies || a.openNow || a.qcReviews || a.trainingPassed || a.trainingOverdue)
    .sort((a, b) => b.resolved + b.replies - (a.resolved + a.replies) || a.name.localeCompare(b.name));

  // ---- Quality ----
  let quality: Report["quality"] = null;
  if (reviews) {
    const byLabel = new Map<string, number[]>();
    for (const r of reviews) {
      for (const s of r.scores ?? []) {
        byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), ((s.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100]);
      }
    }
    const totals = reviews.filter((r) => r.total !== null).map((r) => r.total!);
    quality = {
      reviews: totals.length,
      average: totals.length ? Math.round(mean(totals)!) : null,
      byCriterion: [...byLabel]
        .map(([label, values]) => ({ label, average: Math.round(mean(values)!) }))
        .sort((a, b) => a.average - b.average),
    };
  }

  // ---- Bot ----
  let bot: Report["bot"] = null;
  if (chats) {
    const inPeriodChats = chats.filter((c) => inPeriod(c.created_at, period));
    const handed = inPeriodChats.filter((c) => c.status === "handed_off");
    bot = {
      chats: inPeriodChats.length,
      resolvedByBot: inPeriodChats.length - handed.length,
      handedOff: handed.length,
      deflectionPercent: percent(inPeriodChats.length - handed.length, inPeriodChats.length),
      reasons: [...groupBy(handed, (c) => (c.handoff_type ? HANDOFF_LABELS[c.handoff_type] ?? c.handoff_type : "Not recorded"))]
        .map(([reason, list]) => ({ reason, count: list.length }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // ---- Training ----
  let training: Report["training"] = null;
  if (assignments) {
    const best = assignments.filter((a) => a.best_score !== null).map((a) => a.best_score!);
    training = {
      open: assignments.filter((a) => a.status !== "passed").length,
      passed: assignments.filter((a) => a.passed_at && inPeriod(a.passed_at, period)).length,
      overdue: assignments.filter((a) => a.status !== "passed" && a.due_date !== null && a.due_date < today).length,
      averageBestScore: best.length ? Math.round(mean(best)!) : null,
    };
  }

  return {
    generatedAt: now,
    summary: current.summary,
    previous: previous.summary,
    backlog: {
      open: open.length,
      breached: open.filter((t) => isBreached(toSla(t), now)).length,
      atRisk: open.filter((t) => isAtRisk(toSla(t), now)).length,
      unassigned: open.filter((t) => t.assigned_to === "Unassigned").length,
      oldestOpenMinutes: oldest ? minutesBetween(oldest, new Date(now).toISOString()) : null,
    },
    trend: points,
    trendStep: step,
    byChannel,
    byCategory,
    byPriority,
    agents,
    quality,
    bot,
    training,
  };
}

function inPeriod(iso: string, period: Period) {
  const t = Date.parse(iso);
  return t >= period.from && t < period.to;
}
