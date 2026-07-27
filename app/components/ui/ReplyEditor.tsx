"use client";

import ReplyTemplates from "./ReplyTemplates";

type ReplyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
};

export default function ReplyEditor({
  value,
  onChange,
  onSend,
}: ReplyEditorProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-2xl font-semibold">
        Reply to Customer
      </h2>

      <ReplyTemplates
        onSelect={onChange}
      />

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your reply..."
        className="h-48 w-full rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />

      <div className="mt-6 flex items-center justify-between">
        <button className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800">
          📎 Attach File
        </button>

        <div className="space-x-3">
          <button className="rounded-lg border border-zinc-700 px-4 py-2 hover:bg-zinc-800">
            Save Draft
          </button>

          <button
            onClick={onSend}
            disabled={!value.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}