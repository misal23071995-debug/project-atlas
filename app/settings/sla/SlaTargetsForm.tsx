"use client";

import { useActionState } from "react";
import { formatMinutes, sortedPriorities, type SlaTargets } from "@/app/lib/sla";
import { saveSlaTargetsAction } from "./actions";

const inputClass =
  "w-28 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60";

export default function SlaTargetsForm({ targets, canEdit }: { targets: SlaTargets; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(saveSlaTargetsAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="text-left text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">First reply within</th>
              <th className="px-4 py-3 font-medium">Resolve within</th>
            </tr>
          </thead>
          <tbody>
            {sortedPriorities().map((priority) => (
              <tr key={priority} className="border-t border-zinc-800">
                <td className="px-4 py-3 font-medium">{priority}</td>
                <td className="px-4 py-3">
                  <input
                    name={`${priority}.reply`}
                    aria-label={`${priority} first reply`}
                    defaultValue={formatMinutes(targets[priority].firstResponseMinutes)}
                    disabled={!canEdit}
                    required
                    className={inputClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    name={`${priority}.resolve`}
                    aria-label={`${priority} resolve`}
                    defaultValue={formatMinutes(targets[priority].resolutionMinutes)}
                    disabled={!canEdit}
                    required
                    className={inputClass}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <>
          <p className="text-xs text-zinc-500">Write times like 15m, 4h, 1h 30m or 3d.</p>
          {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
          {state.success && <p role="status" className="text-sm text-emerald-400">{state.success}</p>}
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save targets"}
          </button>
        </>
      )}
    </form>
  );
}
