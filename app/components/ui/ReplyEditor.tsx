"use client";

import ReplyTemplates from "./ReplyTemplates";
import type { PlaceholderValues, SavedReply } from "@/app/lib/replies";
import { ACCEPT, MAX_FILES_PER_MESSAGE, formatBytes } from "@/app/lib/attachments";

export interface PendingFile {
  key: string;
  fileName: string;
  size: number;
  status: "uploading" | "ready" | "error";
  path?: string;
  error?: string;
}

type ReplyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  savedReplies: SavedReply[];
  placeholders: PlaceholderValues;
  title?: string;
  // Under the box, e.g. where an email reply goes
  note?: string;
  files?: PendingFile[];
  onAttach?: (files: File[]) => void;
  onRemoveFile?: (key: string) => void;
};

export default function ReplyEditor({
  value,
  onChange,
  onSend,
  savedReplies,
  placeholders,
  title = "Reply to customer",
  note = "The customer sees this reply.",
  files = [],
  onAttach,
  onRemoveFile,
}: ReplyEditorProps) {
  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "ready").length;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">
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
        className="h-44 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <li
              key={f.key}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                f.status === "error" ? "border-rose-500/40 text-rose-700" : "border-zinc-300 text-zinc-700"
              }`}
              title={f.error}
            >
              <span className="max-w-48 truncate">{f.fileName}</span>
              <span className="text-zinc-500">
                {f.status === "uploading" ? "uploading…" : f.status === "error" ? "failed" : formatBytes(f.size)}
              </span>
              {onRemoveFile && (
                <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => onRemoveFile(f.key)} className="text-zinc-500 hover:text-zinc-800">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {files.some((f) => f.error) && <p role="alert" className="mt-2 text-xs text-rose-700">{files.find((f) => f.error)?.error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {onAttach && (
            <label
              className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800 hover:bg-zinc-100 ${
                files.length >= MAX_FILES_PER_MESSAGE ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path d="m21 11-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.2-9.2a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.2a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Attach
              <input
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  onAttach(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p className="min-w-0 break-words text-xs text-zinc-500">{note}</p>
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={(!value.trim() && !ready) || uploading}
          className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send reply
        </button>
      </div>
    </div>
  );
}