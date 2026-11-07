"use client";

import { useState } from "react";

type Note = {
  author: string;
  time: string;
  note: string;
};

export default function InternalNotes({
  notes,
  onAdd,
  disabled,
}: {
  notes: Note[];
  // Calls onSaved once the note is stored, so the box can be cleared
  onAdd: (note: string, onSaved: () => void) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    if (!draft.trim() || disabled) return;
    onAdd(draft, () => setDraft(""));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="text-lg font-semibold">
        Internal notes
      </h2>
      <p className="mb-6 mt-1 text-xs text-zinc-500">
        Only your team can see these. They are never sent to the customer.
      </p>

      <div className="space-y-5">
        {notes.length === 0 && (
          <p className="text-sm text-zinc-500">No notes yet.</p>
        )}

        {notes.map((note, index) => (
          <div
            key={index}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">
                {note.author}
              </p>

              <p className="text-xs text-zinc-500">
                {note.time}
              </p>
            </div>

            <p className="mt-3 whitespace-pre-line text-sm text-zinc-600">
              {note.note}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Add a note for your team..."
          className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm outline-none focus:border-amber-500/60"
        />

        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled || !draft.trim()}
          className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
        >
          Add note
        </button>
      </div>
    </div>
  );
}
