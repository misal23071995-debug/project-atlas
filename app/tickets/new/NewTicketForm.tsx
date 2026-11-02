"use client";

import { useActionState } from "react";
import { TICKET_PRIORITIES } from "@/app/lib/tickets";
import { createManualTicketAction, type NewTicketFormState } from "../actions";

const CHANNELS = ["Phone", "Email", "Chat", "Walk-in", "Social", "Other"];

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const labelClass = "block text-sm font-medium text-zinc-300";

export default function NewTicketForm() {
  const [state, action, pending] = useActionState<NewTicketFormState, FormData>(
    createManualTicketAction,
    {}
  );

  return (
    <form action={action} className="mt-6 space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Customer name
          <input name="customerName" required maxLength={200} className={inputClass} />
        </label>

        <label className={labelClass}>
          Customer email
          <input name="customerEmail" type="email" required maxLength={320} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Subject
        <input name="subject" required maxLength={300} className={inputClass} />
      </label>

      <label className={labelClass}>
        What does the customer need?
        <textarea name="description" required rows={6} maxLength={5000} className={inputClass} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Channel
          <select name="channel" defaultValue="Phone" className={inputClass}>
            {CHANNELS.map((channel) => (
              <option key={channel}>{channel}</option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Priority
          <select name="priority" defaultValue="Medium" className={inputClass}>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creating ticket…" : "Create ticket"}
      </button>
    </form>
  );
}
