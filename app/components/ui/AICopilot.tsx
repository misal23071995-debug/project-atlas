"use client";

import { useEffect, useState } from "react";
import SparkleIcon from "./SparkleIcon";
import type { AIAnalysis } from "@/app/lib/ai";
import { fetchAnalysis } from "@/app/lib/ai/client";

type AICopilotProps = {
  customerMessage: string;
  onUseReply: (reply: string) => void;
};

export default function AICopilot({
  customerMessage,
  onUseReply,
}: AICopilotProps) {
  const [result, setResult] = useState<{
    message: string;
    analysis: AIAnalysis;
  } | null>(null);

  // Stale until the result for the current message arrives
  const analysis =
    result?.message === customerMessage ? result.analysis : null;

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
      <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 to-white p-6">
        <p className="flex animate-pulse items-center gap-2 text-sm text-zinc-600">
          <SparkleIcon className="h-4 w-4 text-indigo-700" />
          Atlas AI is reading this ticket…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 to-white p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <SparkleIcon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            AI copilot
          </h2>

          <p className="text-sm text-zinc-600">
            Powered by Atlas AI
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h3 className="mb-2 font-semibold text-indigo-600">
          Ticket Summary
        </h3>

        <p className="text-zinc-700">
          {analysis.summary}
        </p>
      </div>
      <div className="mb-6 rounded-lg bg-zinc-100 p-5">
        <h3 className="mb-2 font-semibold">
          Detected Intent
        </h3>

        <p className="text-lg font-medium text-indigo-600">
          {analysis.intent}
        </p>
      </div>
      
      {/* Sentiment */}
      <div className="mb-6 rounded-lg bg-zinc-100 p-5">
        <h3 className="mb-3 font-semibold">
          Detected Sentiment
        </h3>

        <p className="text-3xl">{analysis.sentiment === "Positive"
          ? "😊"
          : analysis.sentiment === "Neutral"
          ? "😐"
          : analysis.sentiment === "Frustrated"
          ? "😟"
          : "😡"}</p>

        <p className="mt-2 text-zinc-600">
          {analysis.sentiment}
        </p>
      </div>
      <div className="mb-6 rounded-lg bg-zinc-100 p-5">
        <h3 className="mb-2 font-semibold">
          AI Confidence
        </h3>

        <div className="h-3 w-full rounded-full bg-zinc-200">
          <div
            className="h-3 rounded-full bg-indigo-500"
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-zinc-600">
          {analysis.confidence}% Confidence
        </p>
      </div>
      {/* Suggested Reply */}
      <div>
        <h3 className="mb-3 font-semibold text-indigo-600">
          Suggested Reply
        </h3>

        <div className="rounded-lg bg-zinc-100 p-5 whitespace-pre-line">
          {analysis.suggestedReply}
        </div>

        <button
          onClick={() => onUseReply(analysis.suggestedReply)}
          className="mt-4 rounded-lg bg-indigo-600 px-5 py-2 font-medium transition hover:bg-indigo-500"
        >
          Use Reply
        </button>
      </div>

      {/* Articles */}
      <div className="mt-8">
        <h3 className="mb-3 font-semibold text-indigo-600">
          Related Articles
        </h3>

        <div className="space-y-2">
          {analysis.relatedArticles.map((article) => (
            <a
              key={article}
              href="#"
              className="block text-indigo-600 hover:underline"
            >
              {article}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}