import "server-only";
import { getSupabase } from "./supabase";
import {
  DEFAULT_CRITERIA,
  SCORE_MAX,
  SCORE_MIN,
  type Criterion,
  type CriterionScore,
} from "@/app/lib/quality/types";

// Every function takes the workspace id and only touches that workspace's reviews

const DAY_MS = 24 * 60 * 60 * 1000;

// ---- Scorecard ----

export async function getScorecard(orgId: string): Promise<Criterion[]> {
  const { data, error } = await getSupabase()
    .from("qa_scorecards")
    .select("criteria")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load scorecard: ${error.message}`);
  return (data?.criteria as Criterion[] | undefined) ?? DEFAULT_CRITERIA;
}

export async function saveScorecard(orgId: string, criteria: Criterion[]) {
  const { error } = await getSupabase()
    .from("qa_scorecards")
    .upsert({ org_id: orgId, criteria, updated_at: new Date().toISOString() });

  if (error) throw new Error(`Failed to save scorecard: ${error.message}`);
}

// ---- Reviews ----

export interface QaReview {
  ticketId: string;
  agentName: string;
  status: "pending" | "reviewed";
  aiScores: CriterionScore[] | null;
  aiTotal: number | null;
  aiSummary: string | null;
  scores: CriterionScore[] | null;
  total: number | null;
  feedback: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

type ReviewRow = {
  ticket_id: number;
  agent_name: string;
  status: "pending" | "reviewed";
  ai_scores: CriterionScore[] | null;
  ai_total: number | null;
  ai_summary: string | null;
  scores: CriterionScore[] | null;
  total: number | null;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const REVIEW_COLUMNS =
  "ticket_id, agent_name, status, ai_scores, ai_total, ai_summary, scores, total, feedback, reviewed_by, reviewed_at, created_at";

function toReview(row: ReviewRow): QaReview {
  return {
    ticketId: String(row.ticket_id),
    agentName: row.agent_name,
    status: row.status,
    aiScores: row.ai_scores,
    aiTotal: row.ai_total,
    aiSummary: row.ai_summary,
    scores: row.scores,
    total: row.total,
    feedback: row.feedback,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function getReview(orgId: string, ticketId: string): Promise<QaReview | null> {
  if (!/^\d+$/.test(ticketId)) return null;

  const { data, error } = await getSupabase()
    .from("qa_reviews")
    .select(REVIEW_COLUMNS)
    .eq("org_id", orgId)
    .eq("ticket_id", ticketId)
    .returns<ReviewRow[]>()
    .maybeSingle();

  if (error) throw new Error(`Failed to load review: ${error.message}`);
  return data ? toReview(data) : null;
}

// Stores the AI's scores. A review a person already finalised keeps its final scores.
export async function saveAiScores(
  orgId: string,
  ticketId: string,
  agentName: string,
  aiScores: CriterionScore[],
  aiTotal: number,
  aiSummary: string
) {
  const { error } = await getSupabase()
    .from("qa_reviews")
    .upsert(
      {
        org_id: orgId,
        ticket_id: ticketId,
        agent_name: agentName,
        ai_scores: aiScores,
        ai_total: aiTotal,
        ai_summary: aiSummary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,ticket_id" }
    );

  if (error) throw new Error(`Failed to save AI scores: ${error.message}`);
}

export async function finaliseReview(
  orgId: string,
  ticketId: string,
  review: { agentName: string; scores: CriterionScore[]; total: number; feedback: string; reviewedBy: string }
) {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("qa_reviews")
    .upsert(
      {
        org_id: orgId,
        ticket_id: ticketId,
        agent_name: review.agentName,
        status: "reviewed",
        scores: review.scores,
        total: review.total,
        feedback: review.feedback || null,
        reviewed_by: review.reviewedBy,
        reviewed_at: now,
        updated_at: now,
      },
      { onConflict: "org_id,ticket_id" }
    );

  if (error) throw new Error(`Failed to save review: ${error.message}`);
}

// ---- Overview ----

export interface QueueItem {
  ticketId: string;
  subject: string;
  agentName: string;
  status: string;
  updatedAt: string;
  // Set when the AI has already scored it
  aiTotal: number | null;
}

export interface ReviewSummary {
  ticketId: string;
  subject: string;
  agentName: string;
  total: number;
  aiTotal: number | null;
  reviewedBy: string | null;
  reviewedAt: string;
}

export interface QualityOverview {
  reviewed: number;
  // Average final score of reviews in the period; null with none
  average: number | null;
  // Average gap between the AI's score and the final human score, in points
  aiGap: number | null;
  queue: QueueItem[];
  byAgent: { name: string; reviews: number; average: number; weakest: string | null }[];
  byCriterion: { label: string; average: number }[];
  recent: ReviewSummary[];
}

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

type QueueTicketRow = {
  id: number;
  subject: string;
  assigned_to: string;
  status: string;
  updated_at: string;
  ticket_messages: { sender: string; role: string; created_at: string }[];
};

// Last 30 days of final reviews, plus tickets with agent replies that nobody has finalised yet.
// With agentName, only that agent's reviews (what an agent sees about themselves).
export async function getQualityOverview(
  orgId: string,
  { agentName }: { agentName?: string } = {}
): Promise<QualityOverview | null> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();

  let reviewsQuery = supabase
    .from("qa_reviews")
    .select(`${REVIEW_COLUMNS}, ticket:tickets (subject)`)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (agentName) reviewsQuery = reviewsQuery.eq("agent_name", agentName);

  const [reviewsRes, ticketsRes] = await Promise.all([
    reviewsQuery.returns<(ReviewRow & { ticket: { subject: string } | null })[]>(),
    // Inner join: only tickets that have at least one agent reply can be scored
    supabase
      .from("tickets")
      .select("id, subject, assigned_to, status, updated_at, ticket_messages!inner (sender, role, created_at)")
      .eq("org_id", orgId)
      .eq("ticket_messages.role", "agent")
      .order("updated_at", { ascending: false })
      .limit(200)
      .returns<QueueTicketRow[]>(),
  ]);

  // PGRST205: qa_reviews doesn't exist yet (migration 007 not run)
  if (reviewsRes.error?.code === "PGRST205") return null;
  if (reviewsRes.error) throw new Error(`Failed to load reviews: ${reviewsRes.error.message}`);
  if (ticketsRes.error) throw new Error(`Failed to load tickets: ${ticketsRes.error.message}`);

  const allReviews = reviewsRes.data;
  const final = allReviews.filter(
    (r) => r.status === "reviewed" && r.total !== null && r.reviewed_at && r.reviewed_at >= since
  );
  const reviewedIds = new Set(allReviews.filter((r) => r.status === "reviewed").map((r) => r.ticket_id));
  const aiTotals = new Map(allReviews.map((r) => [r.ticket_id, r.ai_total]));

  const queue: QueueItem[] = agentName
    ? []
    : ticketsRes.data
        .filter((t) => !reviewedIds.has(t.id))
        .slice(0, 25)
        .map((t) => ({
          ticketId: String(t.id),
          subject: t.subject,
          agentName: agentForTicket(t.assigned_to, t.ticket_messages),
          status: t.status,
          updatedAt: t.updated_at,
          aiTotal: aiTotals.get(t.id) ?? null,
        }));

  // Average percentage per criterion, matched by label so renamed criteria stay separate
  const criterionAverages = (reviews: typeof final) => {
    const byLabel = new Map<string, number[]>();
    for (const r of reviews) {
      for (const s of r.scores ?? []) {
        byLabel.set(s.label, [...(byLabel.get(s.label) ?? []), ((s.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100]);
      }
    }
    return [...byLabel].map(([label, values]) => ({ label, average: average(values)! }));
  };

  const agents = new Map<string, typeof final>();
  for (const r of final) agents.set(r.agent_name, [...(agents.get(r.agent_name) ?? []), r]);

  const gaps = final.filter((r) => r.ai_total !== null).map((r) => Math.abs(r.total! - r.ai_total!));

  return {
    reviewed: final.length,
    average: average(final.map((r) => r.total!)),
    aiGap: average(gaps),
    queue,
    byAgent: [...agents]
      .map(([name, reviews]) => {
        const weakest = criterionAverages(reviews).sort((a, b) => a.average - b.average)[0];
        return {
          name,
          reviews: reviews.length,
          average: average(reviews.map((r) => r.total!))!,
          weakest: weakest && weakest.average < 75 ? weakest.label : null,
        };
      })
      .sort((a, b) => b.average - a.average),
    byCriterion: criterionAverages(final).sort((a, b) => a.average - b.average),
    recent: final.slice(0, 10).map((r) => ({
      ticketId: String(r.ticket_id),
      subject: r.ticket?.subject ?? "",
      agentName: r.agent_name,
      total: r.total!,
      aiTotal: r.ai_total,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at!,
    })),
  };
}

// The assignee, or else whoever sent the latest agent reply
export function agentForTicket(assignedTo: string, messages: { sender: string; role: string; created_at: string }[]) {
  if (assignedTo && assignedTo !== "Unassigned") return assignedTo;
  const latest = [...messages]
    .filter((m) => m.role === "agent")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest?.sender ?? "Unassigned";
}
