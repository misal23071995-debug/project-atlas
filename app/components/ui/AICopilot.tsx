"use client";

import { useEffect, useState } from "react";
import SparkleIcon from "./SparkleIcon";
import type { AIAnalysis } from "@/app/lib/ai";
import { fetchAnalysis } from "@/app/lib/ai/client";

const SENTIMENT_STYLES: Record<string, string> = {
  Positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
  Frustrated: "bg-amber-50 text-amber-800 ring-amber-600/20",
  Angry: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

// The AI's reading of the latest customer message: summary, intent, mood, and a draft reply
export default function AICopilot({ customerMessage, onUseReply }: { customerMessage: string; onUseReply: (reply: string) => void }) {
  const [result, setResult] = useState<{ message: string; analysis: AIAnalysis } | null>(null);
  // Stale until the result for the current message arrives
  const analysis = result?.message === customerMessage ? result.analysis : null;

  useEffect(() => {
    let cancelled = false;
    fetchAnalysis(customerMessage).then((analysis) => {
      if (!cancelled) setResult({ message: customerMessage, analysis });
    });
    return () => {
      cancelled = true;
    };
  }, [customerMessage]);

  if (!analysis) {
    return (
      <p className="flex animate-pulse items-center gap-2 text-sm text-zinc-500">
        <SparkleIcon className="h-4 w-4 text-indigo-500" />
        Reading the latest message…
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="leading-6 text-zinc-800">{analysis.summary}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/15">{analysis.intent}</span>
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SENTIMENT_STYLES[analysis.sentiment] ?? SENTIMENT_STYLES.Neutral}`}>
          {analysis.sentiment}
        </span>
        <span className="text-xs text-zinc-500">{analysis.confidence}% sure</span>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="mb-1.5 text-xs font-medium text-zinc-500">Suggested reply</p>
        <p className="line-clamp-6 whitespace-pre-line leading-6 text-zinc-800">{analysis.suggestedReply}</p>
        <button
          type="button"
          onClick={() => onUseReply(analysis.suggestedReply)}
          className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          <SparkleIcon className="h-3.5 w-3.5" />
          Use in reply
        </button>
      </div>
      {analysis.relatedArticles.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500">Related articles</p>
          <ul className="space-y-0.5">
            {analysis.relatedArticles.map((a) => (
              <li key={a} className="truncate text-indigo-700">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
