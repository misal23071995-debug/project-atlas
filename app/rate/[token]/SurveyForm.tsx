"use client";

import { useActionState, useState } from "react";
import { rateTicketAction } from "./actions";

const LABELS = ["", "Very unhappy", "Unhappy", "OK", "Happy", "Very happy"];

export default function SurveyForm({ token, rating, comment }: { token: string; rating: number | null; comment: string | null }) {
  const [state, formAction, pending] = useActionState(rateTicketAction.bind(null, token), {});
  const [stars, setStars] = useState(rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || stars;

  if (state.saved) {
    return (
      <div className="text-center">
        <p className="text-4xl" aria-hidden>
          🙏
        </p>
        <h2 className="mt-3 text-xl font-semibold">Thanks for your feedback</h2>
        <p className="mt-2 text-sm text-zinc-400">It goes straight to the support team. You can close this page.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm text-zinc-300">How happy are you with the help you got?</legend>
        <div className="flex justify-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name="rating"
                value={n}
                checked={stars === n}
                onChange={() => setStars(n)}
                className="sr-only"
                aria-label={`${n} star${n > 1 ? "s" : ""}: ${LABELS[n]}`}
              />
              <span className={`text-4xl transition-colors ${n <= shown ? "text-amber-400" : "text-zinc-700"}`} aria-hidden>
                ★
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 h-5 text-center text-sm text-zinc-400">{LABELS[shown]}</p>
      </fieldset>

      <label className="block text-sm text-zinc-300">
        Anything you&apos;d like to add? (optional)
        <textarea
          name="comment"
          defaultValue={comment ?? ""}
          maxLength={1000}
          rows={4}
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        />
      </label>

      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || !stars}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Sending…" : rating ? "Update my rating" : "Send rating"}
      </button>
    </form>
  );
}
