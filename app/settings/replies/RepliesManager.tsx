"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { KB_CATEGORIES } from "@/app/lib/bot/types";
import { MAX_REPLY_BODY, MAX_REPLY_TITLE, PLACEHOLDERS, type SavedReply } from "@/app/lib/replies";
import { addStarterRepliesAction, deleteReplyAction, saveReplyAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60";

function Editor({ reply, canEdit, onDone }: { reply: SavedReply | null; canEdit: boolean; onDone: () => void }) {
  const [state, formAction, saving] = useActionState(saveReplyAction, {});
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  // Puts the placeholder where the cursor is
  function insert(key: string) {
    const el = body.current;
    if (!el) return;
    const text = `{{${key}}}`;
    const start = el.selectionStart ?? el.value.length;
    el.setRangeText(text, start, el.selectionEnd ?? start, "end");
    el.focus();
  }

  function remove() {
    if (!reply || !window.confirm(`Delete "${reply.title}"?`)) return;
    setError(null);
    startDelete(async () => {
      try {
        await deleteReplyAction(reply.id);
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete the reply.");
      }
    });
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <input type="hidden" name="id" value={reply?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          Title
          <input name="title" defaultValue={reply?.title} required maxLength={MAX_REPLY_TITLE} disabled={!canEdit} className={inputClass} />
        </label>
        <label className="block text-sm text-zinc-400">
          Category
          <select name="category" defaultValue={reply?.category ?? "Other"} disabled={!canEdit} className={inputClass}>
            {KB_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm text-zinc-400">
        Reply
        <textarea
          ref={body}
          name="body"
          defaultValue={reply?.body}
          required
          maxLength={MAX_REPLY_BODY}
          disabled={!canEdit}
          rows={12}
          className={`${inputClass} font-mono`}
        />
      </label>

      {canEdit && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Insert:</span>
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => insert(p.key)}
                title={`{{${p.key}}}`}
                className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-300 hover:bg-zinc-800"
              >
                {p.label}
              </button>
            ))}
          </div>

          {(state.error || error) && <p role="alert" className="text-sm text-red-400">{state.error ?? error}</p>}
          {state.success && <p role="status" className="text-sm text-emerald-400">{state.success}</p>}

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : reply ? "Save changes" : "Add reply"}
            </button>
            {reply && (
              <button type="button" onClick={remove} disabled={deleting} className="text-sm text-red-400 hover:text-red-300">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
        </>
      )}
    </form>
  );
}

export default function RepliesManager({ replies, canEdit }: { replies: SavedReply[]; canEdit: boolean }) {
  const [selected, setSelected] = useState<string | "new" | null>(replies[0]?.id ?? (canEdit ? "new" : null));
  const [adding, startAdding] = useTransition();
  const current = replies.find((r) => r.id === selected) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => setSelected("new")}
            className={`w-full rounded-lg border px-4 py-2 text-left text-sm font-medium ${
              selected === "new" ? "border-indigo-500 bg-indigo-500/10 text-indigo-200" : "border-dashed border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            + New reply
          </button>
        )}
        {replies.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r.id)}
            className={`w-full rounded-lg border px-4 py-2.5 text-left ${
              selected === r.id ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
            }`}
          >
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-xs text-zinc-500">{r.category}</p>
          </button>
        ))}
        {!replies.length && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
            No saved replies yet.
            {canEdit && (
              <button
                type="button"
                disabled={adding}
                onClick={() => startAdding(() => addStarterRepliesAction())}
                className="mt-3 block font-medium text-indigo-400 hover:text-indigo-300"
              >
                {adding ? "Adding…" : "Add 5 starter replies"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {selected === "new" || current ? (
          // A new key per reply resets the form when switching
          <Editor key={selected ?? "none"} reply={current} canEdit={canEdit} onDone={() => setSelected(canEdit ? "new" : null)} />
        ) : (
          <p className="text-sm text-zinc-500">Choose a reply to read it.</p>
        )}
      </div>
    </div>
  );
}
