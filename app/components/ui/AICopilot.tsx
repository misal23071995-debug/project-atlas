"use client";

import { analyzeMessage } from "@/app/lib/ai";

type AICopilotProps = {
  customerMessage: string;
  onUseReply: (reply: string) => void;
};

export default function AICopilot({
  customerMessage,
  onUseReply,
}: AICopilotProps) {
  const analysis = analyzeMessage(customerMessage);
  return (
    <div className="rounded-xl border border-indigo-900 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-xl">
          ✨
        </div>

        <div>
          <h2 className="text-2xl font-bold">
            AI Copilot
          </h2>

          <p className="text-sm text-zinc-400">
            Powered by Atlas AI
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h3 className="mb-2 font-semibold text-indigo-400">
          Ticket Summary
        </h3>

        <p className="text-zinc-300">
          {analysis.summary}
        </p>
      </div>
      <div className="mb-6 rounded-lg bg-zinc-800 p-5">
        <h3 className="mb-2 font-semibold">
          Detected Intent
        </h3>

        <p className="text-lg font-medium text-indigo-400">
          {analysis.intent}
        </p>
      </div>
      
      {/* Sentiment */}
      <div className="mb-6 rounded-lg bg-zinc-800 p-5">
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

        <p className="mt-2 text-zinc-400">
          {analysis.sentiment}
        </p>
      </div>
      <div className="mb-6 rounded-lg bg-zinc-800 p-5">
        <h3 className="mb-2 font-semibold">
          AI Confidence
        </h3>

        <div className="h-3 w-full rounded-full bg-zinc-700">
          <div
            className="h-3 rounded-full bg-indigo-500"
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-zinc-400">
          {analysis.confidence}% Confidence
        </p>
      </div>
      {/* Suggested Reply */}
      <div>
        <h3 className="mb-3 font-semibold text-indigo-400">
          Suggested Reply
        </h3>

        <div className="rounded-lg bg-zinc-800 p-5 whitespace-pre-line">
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
        <h3 className="mb-3 font-semibold text-indigo-400">
          Related Articles
        </h3>

        <div className="space-y-2">
          {analysis.relatedArticles.map((article) => (
            <a
              key={article}
              href="#"
              className="block text-indigo-400 hover:underline"
            >
              {article}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}