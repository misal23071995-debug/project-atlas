"use client";

import ReplyTemplates from "./ReplyTemplates";
import type { PlaceholderValues, SavedReply } from "@/app/lib/replies";

type ReplyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  savedReplies: SavedReply[];
  placeholders: PlaceholderValues;
  title?: string;
  // Under the box, e.g. where an email reply goes
  note?: string;
};

export default function ReplyEditor({
  value,
  onChange,
  onSend,
  savedReplies,
  placeholders,
  title = "Reply to customer",
  note = "The customer sees this reply.",
}: ReplyEditorProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-zinc-50">
        {title}
      </h2>

      <ReplyTemplates
        replies={savedReplies}
        values={placeholders}
        // Added below anything already typed, so a draft isn't lost
        onSelect={(reply) => onChange(value.trim() ? `${value.trimEnd()}\n\n${reply}` : reply)}
      />

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your reply..."
        className="h-44 w-full rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 break-words text-xs text-zinc-500">{note}</p>
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim()}
          className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send reply
        </button>
      </div>
    </div>
  );
}