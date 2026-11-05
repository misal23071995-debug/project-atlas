"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/app/lib/audit";
import { requireSession } from "@/app/lib/auth/session";
import { getTicket } from "@/app/lib/db/tickets";
import { agentForTicket, finaliseReview, getScorecard, saveAiScores, saveScorecard } from "@/app/lib/db/quality";
import { scoreConversation } from "@/app/lib/quality/ai";
import { assignTrainingForLowScores } from "@/app/lib/training/auto";
import {
  MAX_CRITERIA,
  SCORE_MAX,
  SCORE_MIN,
  totalScore,
  type Criterion,
} from "@/app/lib/quality/types";
import type { TicketDetail } from "@/app/lib/tickets";

function agentOf(ticket: TicketDetail) {
  return agentForTicket(
    ticket.assignedTo,
    ticket.conversation.map((m) => ({ sender: m.sender, role: m.role, created_at: m.time }))
  );
}

async function loadScorableTicket(orgId: string, ticketId: string) {
  const ticket = await getTicket(orgId, ticketId);
  if (!ticket) throw new Error("Ticket not found");
  if (!ticket.conversation.some((m) => m.role === "agent")) {
    throw new Error("This ticket has no agent replies to score yet.");
  }
  return ticket;
}

// Asks Gemini to score the conversation against the workspace's scorecard
export async function scoreWithAiAction(ticketId: string): Promise<{ ok: boolean; error?: string }> {
  const { org } = await requireSession("quality.review");

  try {
    const ticket = await loadScorableTicket(org.id, ticketId);
    const criteria = await getScorecard(org.id);
    const agentName = agentOf(ticket);
    const result = await scoreConversation(criteria, ticket.conversation, agentName, org.name);

    await saveAiScores(org.id, ticketId, agentName, result.scores, totalScore(result.scores), result.summary);
  } catch (err) {
    console.error("AI quality scoring failed:", err);
    const message = err instanceof Error ? err.message : "";
    return {
      ok: false,
      error: message.includes("no agent replies")
        ? message
        : "The AI couldn't score this right now (the free quota may be used up). You can still score it yourself.",
    };
  }

  revalidatePath(`/quality/${ticketId}`);
  revalidatePath("/quality");
  return { ok: true };
}

// The reviewer's final scores, one per criterion on the current scorecard
export async function finaliseReviewAction(
  ticketId: string,
  scores: Record<string, number>,
  feedback: string
): Promise<{ ok: boolean; error?: string; training?: string[] }> {
  const { agent, org } = await requireSession("quality.review");
  let training: string[] = [];

  try {
    const ticket = await loadScorableTicket(org.id, ticketId);
    const criteria = await getScorecard(org.id);

    const finalScores = criteria.map((c) => {
      const score = Number(scores?.[c.id]);
      if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
        throw new Error(`Score "${c.label}" from ${SCORE_MIN} to ${SCORE_MAX}.`);
      }
      return { id: c.id, label: c.label, weight: c.weight, score };
    });

    const agentName = agentOf(ticket);
    await finaliseReview(org.id, ticketId, {
      agentName,
      scores: finalScores,
      total: totalScore(finalScores),
      feedback: String(feedback ?? "").trim().slice(0, 2000),
      reviewedBy: agent.name,
    });

    // Low scores on a criterion assign the training course linked to it
    training = await assignTrainingForLowScores(org.id, agentName, finalScores, ticketId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the review." };
  }

  revalidatePath(`/quality/${ticketId}`);
  revalidatePath("/quality");
  if (training.length) revalidatePath("/training");
  return { ok: true, training };
}

export async function saveScorecardAction(
  criteria: Partial<Criterion>[]
): Promise<{ ok: boolean; error?: string }> {
  const { agent, org } = await requireSession("quality.scorecard");

  if (!Array.isArray(criteria) || criteria.length === 0) return { ok: false, error: "Add at least one criterion." };
  if (criteria.length > MAX_CRITERIA) return { ok: false, error: `Use at most ${MAX_CRITERIA} criteria.` };

  const usedIds = new Set<string>();
  const cleaned: Criterion[] = [];

  for (const raw of criteria) {
    const label = String(raw.label ?? "").trim().slice(0, 80);
    const description = String(raw.description ?? "").trim().slice(0, 400);
    const weight = Math.round(Number(raw.weight));

    if (!label) return { ok: false, error: "Every criterion needs a name." };
    if (!Number.isFinite(weight) || weight < 1 || weight > 100) {
      return { ok: false, error: `Give "${label}" a weight from 1 to 100.` };
    }

    // Keep existing ids so old reviews still line up; make one from the name for new criteria
    let id = /^[a-z0-9_]{1,40}$/.test(String(raw.id ?? "")) ? String(raw.id) : "";
    if (!id) id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "criterion";
    let unique = id;
    for (let n = 2; usedIds.has(unique); n++) unique = `${id}_${n}`;
    usedIds.add(unique);

    cleaned.push({ id: unique, label, description, weight });
  }

  try {
    await saveScorecard(org.id, cleaned);
    await audit(org.id, agent, "quality.scorecard_saved", null, { criteria: cleaned.map((c) => `${c.label} (${c.weight})`) });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save the scorecard." };
  }

  revalidatePath("/quality", "layout");
  return { ok: true };
}
