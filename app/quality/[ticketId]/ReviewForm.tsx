"use client";

import { useState, useTransition } from "react";
import SparkleIcon from "@/app/components/ui/SparkleIcon";
import { useRouter } from "next/navigation";
import type { QaReview } from "@/app/lib/db/quality";
import {
  SCORE_LABELS,
  SCORE_MAX,
  SCORE_MIN,
  scoreBand,
  totalScore,
  type Criterion,
} from "@/app/lib/quality/types";
import { formatDateTime } from "@/app/lib/tickets";
import { finaliseReviewAction, scoreWithAiAction } from "../actions";

const SCORE_VALUES = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

export default function ReviewForm({
  ticketId,
  criteria,
  review,
  readOnly,
}: {
  ticketId: string;
  criteria: Criterion[];
  review: QaReview | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [trainingNotes, setTrainingNotes] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();

  const aiById = new Map((review?.aiScores ?? []).map((s) => [s.id, s]));
  const finalById = new Map((review?.scores ?? []).map((s) => [s.id, s]));

  // Start from the final scores, else the AI's, else nothing picked
  const initialScores = () =>
    Object.fromEntries(
      criteria
        .map((c) => [c.id, finalById.get(c.id)?.score ?? aiById.get(c.id)?.score] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== undefined)
    );

  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [feedback, setFeedback] = useState(review?.feedback ?? "");
  // When the AI re-scores, the page reloads with new suggestions; adopt them if nobody has finalised yet
  const [seenAiTotal, setSeenAiTotal] = useState(review?.aiTotal ?? null);
  if ((review?.aiTotal ?? null) !== seenAiTotal) {
    setSeenAiTotal(review?.aiTotal ?? null);
    if (review?.status !== "reviewed") setScores(initialScores());
  }

  const allScored = criteria.every((c) => scores[c.id] !== undefined);
  const liveTotal = allScored
    ? totalScore(criteria.map((c) => ({ weight: c.weight, score: scores[c.id] })))
    : null;

  function scoreWithAi() {
    setError(null);
    startAi(async () => {
      const result = await scoreWithAiAction(ticketId);
      if (!result.ok) setError(result.error ?? "AI scoring failed.");
      else router.refresh();
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await finaliseReviewAction(ticketId, scores, feedback);
      if (!result.ok) setError(result.error ?? "Could not save.");
      else {
        setSaved(true);
        setTrainingNotes(result.training ?? []);
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Scorecard</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {review?.status === "reviewed"
              ? `Reviewed by ${review.reviewedBy} · ${formatDateTime(review.reviewedAt!)}`
              : review?.aiTotal !== null && review?.aiTotal !== undefined
              ? "AI suggestion. Check each score, then save."
              : "Not scored yet"}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-semibold tabular ${liveTotal === null ? "text-zinc-500" : scoreBand(liveTotal).className}`}>
            {liveTotal === null ? "—" : `${liveTotal}%`}
          </p>
          {liveTotal !== null && <p className="text-xs text-zinc-500">{scoreBand(liveTotal).label}</p>}
        </div>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={scoreWithAi}
          disabled={aiPending || isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-60"
        >
          <SparkleIcon />
          {aiPending ? "AI is reading the conversation…" : review?.aiTotal != null ? "Re-score with AI" : "Score with AI"}
        </button>
      )}

      {review?.aiSummary && (
        <div className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
          <p className="text-xs font-medium text-indigo-700">
            AI summary{review.aiTotal !== null && ` · AI score ${review.aiTotal}%`}
          </p>
          <p className="mt-1">{review.aiSummary}</p>
        </div>
      )}

      <ol className="space-y-4">
        {criteria.map((criterion) => {
          const ai = aiById.get(criterion.id);
          const selected = scores[criterion.id];
          return (
            <li key={criterion.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900">{criterion.label}</p>
                <span className="text-xs text-zinc-500">weight {criterion.weight}</span>
              </div>
              <p className="text-xs text-zinc-500">{criterion.description}</p>

              <div className="mt-2 flex gap-1" role="radiogroup" aria-label={criterion.label}>
                {SCORE_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected === value}
                    title={SCORE_LABELS[value]}
                    disabled={readOnly}
                    onClick={() => setScores((current) => ({ ...current, [criterion.id]: value }))}
                    className={`h-8 flex-1 rounded-md border text-sm transition-colors disabled:cursor-default ${
                      selected === value
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : "border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:text-zinc-800"
                    }`}
                  >
                    {value}
                    {ai?.score === value && selected !== value && <span className="ml-0.5 text-[10px] text-indigo-600">AI</span>}
                  </button>
                ))}
              </div>
              {selected !== undefined && <p className="mt-1 text-xs text-zinc-500">{SCORE_LABELS[selected]}</p>}
              {ai?.reason && <p className="mt-1 text-xs text-indigo-700">AI: {ai.reason}</p>}
            </li>
          );
        })}
      </ol>

      <label className="block text-sm text-zinc-600">
        Feedback for the agent
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          readOnly={readOnly}
          rows={4}
          maxLength={2000}
          placeholder={readOnly ? "" : "What went well, and one thing to do differently next time"}
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500"
        />
      </label>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-600">Review saved.</p>}
      {trainingNotes.map((note) => (
        <p key={note} className="text-sm text-indigo-700">
          🎓 {note}
        </p>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={save}
          disabled={!allScored || isPending || aiPending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Saving…" : review?.status === "reviewed" ? "Update review" : "Save review"}
        </button>
      )}
    </section>
  );
}
