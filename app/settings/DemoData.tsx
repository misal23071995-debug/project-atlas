"use client";

import { useState, useTransition } from "react";
import { loadDemoDataAction, removeDemoDataAction, type DemoState } from "./demo-actions";

export default function DemoData({ demoTickets }: { demoTickets: number }) {
  const [state, setState] = useState<DemoState>({});
  const [pending, startTransition] = useTransition();
  const loaded = demoTickets > 0;

  function run(action: () => Promise<DemoState>, question: string) {
    if (!window.confirm(question)) return;
    setState({});
    startTransition(async () => setState(await action()));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Fills this workspace with about 90 days of made-up tickets, replies, SLA times, quality reviews and bot chats
        handled by six fictional agents, so the dashboard and Reports have something to show. Everything is tagged
        &ldquo;{"Demo data"}&rdquo; and can be removed in one click; your real tickets aren&apos;t touched.
      </p>
      {loaded && (
        <p className="text-sm text-amber-700">
          {demoTickets.toLocaleString("en-IN")} demo tickets are in this workspace now.
        </p>
      )}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <div className="flex flex-wrap gap-3">
        {!loaded && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                loadDemoDataAction,
                "Add about 1,000 demo tickets to this workspace? Everyone in the workspace will see them until you remove them."
              )
            }
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Loading… this takes about a minute" : "Load demo data"}
          </button>
        )}
        {loaded && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(removeDemoDataAction, "Remove all demo tickets, chats and customers from this workspace? Real data stays.")
            }
            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-60"
          >
            {pending ? "Removing…" : "Remove demo data"}
          </button>
        )}
      </div>
    </div>
  );
}
