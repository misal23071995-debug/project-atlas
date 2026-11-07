"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PublicQuestion, QuizResult } from "@/app/lib/training/types";
import { submitQuizAction } from "../actions";

export default function TakeCourse({
  courseId,
  questions,
  passPercent,
}: {
  courseId: string;
  questions: PublicQuestion[];
  passPercent: number;
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outcome = new Map(result?.answers.map((a) => [a.id, a]));
  const allAnswered = questions.every((q) => chosen[q.id] !== undefined);

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await submitQuizAction(courseId, chosen);
      if (!response.ok) return setError(response.error);
      setResult(response.result);
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-900">Quiz</h2>
        <p className="text-sm text-zinc-500">
          {questions.length} questions · pass at {passPercent}%
        </p>
      </div>

      {result && (
        <div
          role="status"
          className={`rounded-xl border p-5 ${
            result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}
        >
          <p className={`text-2xl font-semibold ${result.passed ? "text-emerald-600" : "text-amber-700"}`}>
            {result.score}% · {result.passed ? "Passed 🎉" : "Not passed yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            {result.passed
              ? "Well done. Your result is saved."
              : `You need ${passPercent}%. Read the explanations below, then try again.`}
          </p>
        </div>
      )}

      <ol className="space-y-4">
        {questions.map((q, index) => {
          const graded = outcome.get(q.id);
          return (
            <li key={q.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="font-medium text-zinc-900">
                {index + 1}. {q.question}
              </p>
              <div className="mt-3 space-y-2" role="radiogroup" aria-label={`Question ${index + 1}`}>
                {q.options.map((option, optionIndex) => {
                  const isChosen = chosen[q.id] === optionIndex;
                  const isRight = graded?.answer === optionIndex;
                  const style = graded
                    ? isRight
                      ? "border-emerald-400 bg-emerald-50"
                      : isChosen
                      ? "border-rose-400 bg-rose-50"
                      : "border-zinc-200"
                    : isChosen
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-zinc-200 hover:border-zinc-300";

                  return (
                    <label key={optionIndex} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${style}`}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={isChosen}
                        disabled={Boolean(result)}
                        onChange={() => setChosen((current) => ({ ...current, [q.id]: optionIndex }))}
                      />
                      <span className="text-zinc-800">{option}</span>
                      {graded && isRight && <span className="ml-auto text-xs text-emerald-600">Correct answer</span>}
                    </label>
                  );
                })}
              </div>
              {graded?.explanation && <p className="mt-3 text-sm text-zinc-600">{graded.explanation}</p>}
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      {result ? (
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setChosen({});
          }}
          className="rounded-md border border-zinc-200 bg-white shadow-sm px-5 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
        >
          Try again
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!allAnswered || isPending}
          className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? "Checking…" : allAnswered ? "Submit answers" : "Answer every question to submit"}
        </button>
      )}
    </section>
  );
}
