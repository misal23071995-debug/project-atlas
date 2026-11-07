"use client";

import { ACCEPT, MAX_FILES_PER_MESSAGE, formatBytes } from "@/app/lib/attachments";
import { fillPlaceholders, type PlaceholderValues, type SavedReply } from "@/app/lib/replies";
import { TICKET_STATUSES, type TicketStatus } from "@/app/lib/tickets";

export interface PendingFile {
  key: string;
  fileName: string;
  size: number;
  status: "uploading" | "ready" | "error";
  path?: string;
  error?: string;
}

export type ComposerMode = "reply" | "note";

// Docked at the bottom of the conversation: a public reply or an internal note,
// with saved replies, files and "send and set status" like most support desks
export default function Composer({
  mode,
  onModeChange,
  value,
  onChange,
  canReply,
  replyTo,
  savedReplies,
  placeholders,
  files,
  onAttach,
  onRemoveFile,
  statusAfter,
  onStatusAfterChange,
  currentStatus,
  onSend,
  onAddNote,
  pending,
}: {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  value: string;
  onChange: (value: string) => void;
  canReply: boolean;
  // Who the reply goes to, e.g. "Email to priya@example.com"
  replyTo: string;
  savedReplies: SavedReply[];
  placeholders: PlaceholderValues;
  files: PendingFile[];
  onAttach: (files: File[]) => void;
  onRemoveFile: (key: string) => void;
  statusAfter: TicketStatus | "";
  onStatusAfterChange: (status: TicketStatus | "") => void;
  currentStatus: TicketStatus;
  onSend: () => void;
  onAddNote: () => void;
  pending: boolean;
}) {
  const note = mode === "note" || !canReply;
  const uploading = files.some((f) => f.status === "uploading");
  const ready = files.filter((f) => f.status === "ready").length;
  const canSend = note ? !!value.trim() : !!value.trim() || ready > 0;
  const categories = [...new Set(savedReplies.map((r) => r.category))];

  const tab = (m: ComposerMode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => onModeChange(m)}
      className={`relative px-3 py-2.5 text-sm font-medium ${
        mode === m ? "text-zinc-900 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-indigo-600" : "text-zinc-500 hover:text-zinc-800"
      } ${m === "note" && mode === m ? "after:bg-amber-500" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className={`border-t ${note ? "border-amber-200 bg-amber-50/60" : "border-zinc-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200/80 px-4">
        <div role="tablist" className="flex">
          {canReply && tab("reply", "Reply")}
          {tab("note", "Internal note")}
        </div>
        <p className="min-w-0 truncate text-xs text-zinc-500">{note ? "Only your team sees notes" : replyTo}</p>
      </div>

      <div className="px-4 pt-3">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/⌘ + Enter sends
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSend && !pending && !uploading) {
              e.preventDefault();
              if (note) onAddNote();
              else onSend();
            }
          }}
          rows={4}
          placeholder={note ? "Add a note for your team…" : "Write your reply…"}
          className={`block w-full resize-y rounded-lg border px-3 py-2.5 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 ${
            note ? "border-amber-200 bg-white focus:border-amber-400 focus:ring-amber-500/15" : "border-zinc-200 bg-white focus:border-indigo-400 focus:ring-indigo-500/15"
          }`}
        />

        {!note && files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((f) => (
              <li
                key={f.key}
                title={f.error}
                className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                  f.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                <span className="max-w-44 truncate">{f.fileName}</span>
                <span className="text-zinc-500">{f.status === "uploading" ? "uploading…" : f.status === "error" ? "failed" : formatBytes(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.fileName}`} onClick={() => onRemoveFile(f.key)} className="text-zinc-400 hover:text-zinc-700">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {!note && files.find((f) => f.error) && <p className="mt-1.5 text-xs text-rose-700">{files.find((f) => f.error)?.error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {!note && (
            <>
              <select
                aria-label="Insert a saved reply"
                defaultValue=""
                disabled={!savedReplies.length}
                onChange={(e) => {
                  const r = savedReplies.find((x) => x.id === e.target.value);
                  if (r) {
                    const text = fillPlaceholders(r.body, placeholders);
                    onChange(value.trim() ? `${value.trimEnd()}\n\n${text}` : text);
                  }
                  e.target.value = "";
                }}
                className="h-8 max-w-40 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
              >
                <option value="">Saved replies…</option>
                {categories.map((c) => (
                  <optgroup key={c} label={c}>
                    {savedReplies
                      .filter((r) => r.category === c)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <label
                className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 ${
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
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!note && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              then
              <select
                value={statusAfter}
                onChange={(e) => onStatusAfterChange(e.target.value as TicketStatus | "")}
                className="h-8 max-w-36 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
              >
                <option value="">keep {currentStatus}</option>
                {TICKET_STATUSES.filter((s) => s !== currentStatus).map((s) => (
                  <option key={s} value={s}>
                    set {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={!canSend || pending || uploading}
            onClick={note ? onAddNote : onSend}
            title="Ctrl or ⌘ + Enter"
            className={`inline-flex h-8 items-center rounded-md px-3.5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
              note ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            {pending ? "Saving…" : note ? "Add note" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
