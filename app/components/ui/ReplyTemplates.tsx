"use client";

import Link from "next/link";
import { fillPlaceholders, type PlaceholderValues, type SavedReply } from "@/app/lib/replies";

type Props = {
  replies: SavedReply[];
  values: PlaceholderValues;
  onSelect: (reply: string) => void;
};

// The workspace's saved replies, grouped by category, with placeholders filled in for this ticket
export default function ReplyTemplates({ replies, values, onSelect }: Props) {
  const categories = [...new Set(replies.map((r) => r.category))];

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="saved-reply" className="block text-sm font-medium">
          Saved replies
        </label>
        <Link href="/settings/replies" className="text-xs text-indigo-600 hover:text-indigo-700">
          Manage
        </Link>
      </div>

      <select
        id="saved-reply"
        defaultValue=""
        disabled={!replies.length}
        onChange={(e) => {
          const selected = replies.find((r) => r.id === e.target.value);
          if (selected) onSelect(fillPlaceholders(selected.body, values));
          e.target.value = "";
        }}
        className="w-full rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 disabled:opacity-60"
      >
        <option value="">{replies.length ? "Insert a saved reply…" : "No saved replies yet"}</option>
        {categories.map((category) => (
          <optgroup key={category} label={category}>
            {replies
              .filter((r) => r.category === category)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
