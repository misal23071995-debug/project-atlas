"use client";

import { useState } from "react";
import { formatDateTime } from "@/app/lib/tickets";

type Props = {
  rating: number | null;
  comment: string | null;
  ratedAt: string | null;
  surveyLink: string | null;
  // Adds the link to the reply box
  onInsert?: (link: string) => void;
};

export default function CsatCard({ rating, comment, ratedAt, surveyLink, onInsert }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!surveyLink) return;
    await navigator.clipboard.writeText(surveyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-4 text-xl font-semibold">Customer rating</h2>

      {rating ? (
        <div>
          <p className="text-2xl" aria-label={`${rating} out of 5 stars`}>
            <span className="text-amber-600">{"★".repeat(rating)}</span>
            <span className="text-zinc-300">{"★".repeat(5 - rating)}</span>
            <span className="ml-2 align-middle text-sm text-zinc-600">{rating}/5</span>
          </p>
          {comment && <p className="mt-3 whitespace-pre-line rounded-lg bg-zinc-100 p-3 text-sm">&ldquo;{comment}&rdquo;</p>}
          {ratedAt && <p className="mt-2 text-xs text-zinc-500">Rated {formatDateTime(ratedAt)}</p>}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">Not rated yet. Send the customer their survey link when the issue is sorted.</p>
      )}

      {surveyLink && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100"
          >
            {copied ? "Copied" : "Copy survey link"}
          </button>
          {onInsert && (
            <button
              type="button"
              onClick={() => onInsert(surveyLink)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100"
            >
              Add to reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}
