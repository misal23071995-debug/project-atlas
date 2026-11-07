"use client";

import { useState } from "react";
import { formatDateTime } from "@/app/lib/tickets";

// The customer's rating of this ticket, and their survey link
export default function CsatCard({
  rating,
  comment,
  ratedAt,
  surveyLink,
  onInsert,
}: {
  rating: number | null;
  comment: string | null;
  ratedAt: string | null;
  surveyLink: string | null;
  // Adds the link to the reply box
  onInsert?: (link: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-2.5 text-sm">
      {rating ? (
        <>
          <p className="flex items-center gap-2" aria-label={`${rating} out of 5 stars`}>
            <span className="text-lg leading-none text-amber-500">{"★".repeat(rating)}</span>
            <span className="text-lg leading-none text-zinc-200">{"★".repeat(5 - rating)}</span>
            <span className="text-xs text-zinc-500">{ratedAt && formatDateTime(ratedAt)}</span>
          </p>
          {comment && <p className="rounded-md bg-zinc-50 px-3 py-2 text-zinc-700">&ldquo;{comment}&rdquo;</p>}
        </>
      ) : (
        <p className="text-zinc-500">Not rated yet.</p>
      )}
      {surveyLink && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(surveyLink);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="h-7 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            {copied ? "Copied" : "Copy survey link"}
          </button>
          {onInsert && (
            <button type="button" onClick={() => onInsert(surveyLink)} className="h-7 rounded-md border border-zinc-200 px-2.5 text-xs text-zinc-700 hover:bg-zinc-50">
              Add to reply
            </button>
          )}
        </div>
      )}
    </div>
  );
}
