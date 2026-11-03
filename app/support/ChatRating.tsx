"use client";

import { useState, useTransition } from "react";
import { rateChatAction } from "./actions";

const LABELS = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

export default function ChatRating({ conversationId }: { conversationId: string }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return <p className="text-sm text-emerald-400">Thanks for your feedback!</p>;
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await rateChatAction(conversationId, rating, comment);
      if (result.ok) setDone(true);
      else setError(result.error ?? "Couldn't save your rating.");
    });
  }

  const shown = hovered || rating;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300">How did we do?</p>

      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rate this chat" onMouseLeave={() => setHovered(0)}>
        {LABELS.map((label, index) => {
          const value = index + 1;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}: ${label}`}
              onMouseEnter={() => setHovered(value)}
              onClick={() => setRating(value)}
              className={`text-3xl leading-none transition-colors ${
                value <= shown ? "text-amber-400" : "text-zinc-600 hover:text-zinc-500"
              }`}
            >
              ★
            </button>
          );
        })}
      </div>
      <p className="h-4 text-xs text-zinc-500">{shown ? LABELS[shown - 1] : ""}</p>

      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Anything we could do better? (optional)"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send feedback"}
          </button>
        </>
      )}

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
