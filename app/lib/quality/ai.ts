import "server-only";
import { ai } from "@/app/lib/ai/provider";
import type { ConversationMessage } from "@/app/lib/tickets";
import { SCORE_MAX, SCORE_MIN, type Criterion, type CriterionScore } from "./types";

const MODEL = "models/gemini-3.5-flash-lite";
// Long conversations are cut to the most recent messages to stay inside the free tier
const MAX_TRANSCRIPT_CHARS = 12000;

export interface AiQualityResult {
  scores: CriterionScore[];
  summary: string;
}

function buildPrompt(criteria: Criterion[], conversation: ConversationMessage[], agentName: string, brandName: string) {
  const criteriaText = criteria
    .map((c) => `- id "${c.id}": ${c.label} (weight ${c.weight}). ${c.description}`)
    .join("\n");

  let transcript = conversation
    .map((m) => `${m.role === "agent" ? `AGENT (${m.sender})` : `CUSTOMER (${m.sender})`}: ${m.message}`)
    .join("\n\n");
  if (transcript.length > MAX_TRANSCRIPT_CHARS) transcript = `…\n${transcript.slice(-MAX_TRANSCRIPT_CHARS)}`;

  return `You are a quality analyst in the ${brandName} customer support team.
Score how well the support agent ${agentName} handled this conversation.

Score each criterion from ${SCORE_MIN} to ${SCORE_MAX}:
1 = poor, 2 = needs work, 3 = meets standard, 4 = good, 5 = excellent.
Judge only the AGENT messages; the customer's mood is not the agent's fault.
If the conversation gives no evidence for a criterion, score 3 and say so.
Be fair and specific. Each reason is one short sentence that quotes or points to what the agent did.

Criteria:
${criteriaText}

Also write a summary of at most 3 sentences: what the agent did well, and the single most useful thing to improve.

Conversation (the first customer message may contain an earlier chatbot transcript):
${transcript}`;
}

function schemaFor(criteria: Criterion[]) {
  return {
    type: "object",
    properties: {
      scores: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: criteria.map((c) => c.id) },
            score: { type: "integer", minimum: SCORE_MIN, maximum: SCORE_MAX },
            reason: { type: "string" },
          },
          required: ["id", "score", "reason"],
        },
      },
      summary: { type: "string" },
    },
    required: ["scores", "summary"],
    propertyOrdering: ["scores", "summary"],
  };
}

// Throws when Gemini is unavailable or answers badly; the reviewer can still score by hand
export async function scoreConversation(
  criteria: Criterion[],
  conversation: ConversationMessage[],
  agentName: string,
  brandName: string
): Promise<AiQualityResult> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildPrompt(criteria, conversation, agentName, brandName),
    config: { responseMimeType: "application/json", responseJsonSchema: schemaFor(criteria) },
  });

  const parsed = JSON.parse(response.text ?? "") as {
    scores?: { id?: unknown; score?: unknown; reason?: unknown }[];
    summary?: unknown;
  };
  const byId = new Map((parsed.scores ?? []).map((s) => [s.id, s]));

  const scores = criteria.map((c) => {
    const s = byId.get(c.id);
    const score = Number(s?.score);
    if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
      throw new Error(`The AI didn't score "${c.label}"`);
    }
    return {
      id: c.id,
      label: c.label,
      weight: c.weight,
      score,
      reason: typeof s?.reason === "string" ? s.reason.trim().slice(0, 300) : "",
    };
  });

  return {
    scores,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 1000) : "",
  };
}
