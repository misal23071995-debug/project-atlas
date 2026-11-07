"use client";

import { useActionState, useState, useTransition } from "react";
import {
  daysBetween,
  formatDay,
  LEAVE_LABELS,
  LEAVE_TYPES,
  type LeaveRequest,
  type LeaveStatus,
} from "@/app/lib/roster/types";
import { cancelLeaveAction, decideLeaveAction, requestLeaveAction, type LeaveFormState } from "../actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

const STATUS_STYLES: Record<LeaveStatus, string> = {
  requested: "bg-amber-50 text-amber-800 ring-amber-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
  cancelled: "bg-zinc-200 text-zinc-600",
};

const STATUS_LABELS: Record<LeaveStatus, string> = {
  requested: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function dateRange(leave: LeaveRequest) {
  const days = daysBetween(leave.startDate, leave.endDate) + 1;
  const range = days === 1 ? formatDay(leave.startDate) : `${formatDay(leave.startDate)} – ${formatDay(leave.endDate)}`;
  return `${range} · ${days} day${days === 1 ? "" : "s"}`;
}

export default function LeaveView({
  leave,
  currentUserId,
  canManage,
}: {
  leave: LeaveRequest[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState<LeaveFormState, FormData>(requestLeaveAction, {});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const waiting = leave.filter((l) => l.status === "requested");
  const others = leave.filter((l) => l.status !== "requested");

  const row = (item: LeaveRequest) => (
    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900">
          {item.userName}
          {item.userId === currentUserId && <span className="ml-1 text-xs text-zinc-500">(you)</span>}
          <span className="ml-2 text-zinc-600">{LEAVE_LABELS[item.type]}</span>
        </p>
        <p className="text-xs text-zinc-500">{dateRange(item)}</p>
        {item.note && <p className="mt-1 text-xs text-zinc-600">&ldquo;{item.note}&rdquo;</p>}
      </div>

      <div className="flex items-center gap-3">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[item.status]}`}>
          {STATUS_LABELS[item.status]}
          {item.decidedBy && item.status !== "requested" && ` by ${item.decidedBy}`}
        </span>
        {canManage && item.status === "requested" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => decideLeaveAction(item.id, "approved"))}
              className="rounded-md bg-emerald-600 px-3 py-1.5 shadow-sm text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => decideLeaveAction(item.id, "rejected"))}
              className="rounded-md border border-zinc-200 bg-white shadow-sm px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
        {(item.userId === currentUserId || canManage) && (item.status === "requested" || item.status === "approved") && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => cancelLeaveAction(item.id))}
            className="text-xs text-zinc-500 hover:text-rose-600 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="mt-6 grid items-start gap-4 lg:grid-cols-3">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Request leave</h2>
        <form action={action} key={state.success} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-zinc-700">
              First day
              <input type="date" name="startDate" required className={inputClass} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Last day
              <input type="date" name="endDate" className={inputClass} />
            </label>
          </div>
          <label className="block text-sm font-medium text-zinc-700">
            Type
            <select name="type" defaultValue="annual" className={inputClass}>
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LEAVE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Note (optional)
            <textarea name="note" rows={2} maxLength={500} className={inputClass} />
          </label>

          {state.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
          {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Request leave"}
          </button>
        </form>
      </section>

      <div className="space-y-4 lg:col-span-2">
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">
            Waiting for approval <span className="text-sm font-normal text-zinc-500">({waiting.length})</span>
          </h2>
          {waiting.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nothing waiting.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">{waiting.map(row)}</ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">{canManage ? "Team leave" : "Your leave"}</h2>
          {others.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No leave in the last 90 days or coming up.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">{others.map(row)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
