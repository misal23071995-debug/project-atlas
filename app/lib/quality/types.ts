// Quality check (QC) scorecards and reviews. Safe to import from Client Components.

export interface Criterion {
  // Short stable key, e.g. "accuracy"; reviews refer to criteria by it
  id: string;
  label: string;
  // What a reviewer (or the AI) should look for
  description: string;
  // Relative importance; the total score is the weighted average
  weight: number;
}

export interface CriterionScore {
  id: string;
  label: string;
  weight: number;
  // 1-5, see SCORE_LABELS
  score: number;
  // The AI's one-line reason; empty on human scores
  reason?: string;
}

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const SCORE_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Needs work",
  3: "Meets standard",
  4: "Good",
  5: "Excellent",
};

export const MAX_CRITERIA = 12;

// A common contact-centre scorecard; each workspace can edit its own copy
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    id: "greeting",
    label: "Greeting and tone",
    description: "Friendly, professional opening and tone that fits the brand throughout.",
    weight: 10,
  },
  {
    id: "understanding",
    label: "Understood the issue",
    description: "Identified the real problem, asked the right questions and didn't make the customer repeat themselves.",
    weight: 20,
  },
  {
    id: "accuracy",
    label: "Correct resolution",
    description: "Gave accurate information and a fix that matches company policy. No wrong promises.",
    weight: 30,
  },
  {
    id: "clarity",
    label: "Clear communication",
    description: "Easy to follow, well structured replies with clear next steps.",
    weight: 15,
  },
  {
    id: "empathy",
    label: "Empathy",
    description: "Acknowledged the customer's situation and feelings, especially when they were frustrated.",
    weight: 15,
  },
  {
    id: "ownership",
    label: "Ownership and follow-up",
    description: "Took responsibility, set expectations and closed the loop or said what happens next.",
    weight: 10,
  },
];

// Weighted score out of 100. A criterion scored 1 counts as 0%, 5 as 100%.
export function totalScore(scores: Pick<CriterionScore, "weight" | "score">[]) {
  const weightSum = scores.reduce((sum, s) => sum + s.weight, 0);
  if (!weightSum) return 0;

  const weighted = scores.reduce(
    (sum, s) => sum + s.weight * ((s.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)),
    0
  );
  return Math.round((weighted / weightSum) * 100);
}

export function scoreBand(total: number) {
  if (total >= 85) return { label: "Excellent", className: "text-emerald-400" };
  if (total >= 70) return { label: "Good", className: "text-sky-400" };
  if (total >= 50) return { label: "Needs work", className: "text-amber-400" };
  return { label: "Poor", className: "text-red-400" };
}
