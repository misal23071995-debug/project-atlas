"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DashboardLayout from "@/app/components/dashboard-layout";
import { useAgent, useCan } from "@/app/components/AgentProvider";
import { useNow } from "@/app/components/useNow";
import { ChannelLabel, PriorityBadge, StatusBadge } from "@/app/components/ui/Badges";
import SlaBadge from "@/app/components/ui/SlaBadge";
import { initials } from "@/app/lib/auth/agent";
import { currentClock, isAtRisk, isBreached, isDone } from "@/app/lib/sla";
import { TICKET_PRIORITIES, formatDateTime, type Ticket } from "@/app/lib/tickets";

const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;

type View = { id: string; label: string; test: (t: Ticket, now: number | null, me: string) => boolean; sortBySla?: boolean };

// Saved views down the side, as in most support desks
const VIEWS: View[] = [
  { id: "mine", label: "Your open tickets", test: (t, _n, me) => !isDone(t.status) && t.assignedTo === me },
  { id: "unassigned", label: "Unassigned", test: (t) => !isDone(t.status) && t.assignedTo === "Unassigned" },
  { id: "open", label: "All open", test: (t) => !isDone(t.status) },
  { id: "breached", label: "Past SLA", test: (t, n) => n !== null && isBreached(t, n), sortBySla: true },
  { id: "risk", label: "SLA at risk", test: (t, n) => n !== null && isAtRisk(t, n), sortBySla: true },
  { id: "waiting", label: "Waiting on customer", test: (t) => t.status === "Waiting on Customer" },
  { id: "escalated", label: "Escalated", test: (t) => t.status === "Escalated" },
  { id: "solved", label: "Solved in the last 7 days", test: (t, n) => isDone(t.status) && n !== null && n - Date.parse(t.resolvedAt ?? t.createdAt) < 7 * DAY },
  { id: "all", label: "All tickets", test: () => true },
];

function ago(iso: string, now: number | null) {
  if (now === null) return "";
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (m < 60) return `${m}m ago`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ago`;
  if (m < 30 * 24 * 60) return `${Math.floor(m / (24 * 60))}d ago`;
  return formatDateTime(iso);
}

export default function TicketsView({ tickets, initialSearch = "" }: { tickets: Ticket[]; initialSearch?: string }) {
  const me = useAgent()?.name ?? "";
  const canWork = useCan("tickets.work");
  const now = useNow();
  const [viewId, setViewId] = useState(initialSearch ? "all" : "open");
  const [search, setSearch] = useState(initialSearch);
  const [priority, setPriority] = useState("All");
  const [channel, setChannel] = useState("All");
  const [page, setPage] = useState(1);

  const view = VIEWS.find((v) => v.id === viewId) ?? VIEWS[2];
  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.id, tickets.filter((t) => v.test(t, now, me)).length])), [tickets, now, me]);
  const channels = useMemo(() => [...new Set(tickets.map((t) => t.channel))].sort(), [tickets]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, "");
    const list = tickets.filter(
      (t) =>
        view.test(t, now, me) &&
        (priority === "All" || t.priority === priority) &&
        (channel === "All" || t.channel === channel) &&
        (!q ||
          t.id.includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.customer.name.toLowerCase().includes(q) ||
          t.customer.email.toLowerCase().includes(q) ||
          t.assignedTo.toLowerCase().includes(q))
    );
    if (view.sortBySla && now !== null) {
      const left = (t: Ticket) => currentClock(t, now).clock?.minutesLeft ?? Infinity;
      return [...list].sort((a, b) => left(a) - left(b));
    }
    return list;
  }, [tickets, view, now, me, search, priority, channel]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };
  const select = "h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700";

  return (
    <DashboardLayout fullBleed>
      <div className="flex flex-col lg:h-[calc(100vh-3.5rem)] lg:flex-row">
        <nav aria-label="Views" className="border-b border-zinc-200 bg-white lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <h1 className="text-sm font-semibold text-zinc-900">Views</h1>
            {canWork && (
              <Link href="/tickets/new" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                Log a ticket
              </Link>
            )}
          </div>
          <ul className="flex gap-1 overflow-x-auto px-2 pb-3 lg:block lg:space-y-0.5 lg:overflow-visible">
            {VIEWS.map((v) => {
              const active = v.id === view.id;
              const alert = (v.id === "breached" || v.id === "unassigned") && counts[v.id] > 0;
              return (
                <li key={v.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setViewId(v.id);
                      setPage(1);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm ${
                      active ? "bg-indigo-50 font-medium text-indigo-700" : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    {v.label}
                    <span className={`tabular text-xs ${active ? "text-indigo-700" : alert ? "font-semibold text-rose-600" : "text-zinc-500"}`}>
                      {now === null && (v.id === "breached" || v.id === "risk") ? "" : counts[v.id].toLocaleString("en-IN")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">{view.label}</h2>
              <p className="text-xs text-zinc-500 tabular">
                {rows.length.toLocaleString("en-IN")} ticket{rows.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => reset(setSearch)(e.target.value)}
                placeholder="Filter this view"
                aria-label="Filter this view"
                className="h-8 w-52 rounded-md border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400"
              />
              <select value={priority} onChange={(e) => reset(setPriority)(e.target.value)} aria-label="Priority" className={select}>
                <option value="All">Any priority</option>
                {[...TICKET_PRIORITIES].reverse().map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select value={channel} onChange={(e) => reset(setChannel)(e.target.value)} aria-label="Channel" className={select}>
                <option value="All">Any channel</option>
                {channels.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-white">
            {shown.length === 0 ? (
              <p className="px-6 py-20 text-center text-sm text-zinc-500">No tickets in this view.</p>
            ) : (
              <table className="w-full min-w-[58rem] table-fixed text-left text-sm">
                <colgroup>
                  <col />
                  <col className="w-36" />
                  <col className="w-20" />
                  <col className="w-40" />
                  <col className="w-24" />
                  <col className="w-36" />
                  <col className="w-20" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-zinc-50 text-xs text-zinc-500">
                  <tr className="border-b border-zinc-200">
                    <th className="py-2.5 pl-5 pr-3 font-medium">Subject</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Priority</th>
                    <th className="px-3 py-2.5 font-medium">SLA</th>
                    <th className="px-3 py-2.5 font-medium">Channel</th>
                    <th className="px-3 py-2.5 font-medium">Assignee</th>
                    <th className="py-2.5 pl-3 pr-5 text-right font-medium">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {shown.map((t) => (
                    <tr key={t.id} className="group relative hover:bg-indigo-50/40">
                      <td className="max-w-0 py-2.5 pl-5 pr-3">
                        {/* The whole row opens the ticket */}
                        <Link href={`/tickets/${t.id}`} className="absolute inset-0" aria-label={`Ticket ${t.id}: ${t.subject}`} />
                        <p className="truncate font-medium text-zinc-900 group-hover:text-indigo-700">{t.subject}</p>
                        <p className="truncate text-xs text-zinc-500">
                          <span className="font-mono">#{t.id}</span> · {t.customer.name}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="px-3 py-2.5">
                        <SlaBadge ticket={t} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ChannelLabel channel={t.channel} />
                      </td>
                      <td className="px-3 py-2.5">
                        {t.assignedTo === "Unassigned" ? (
                          <span className="text-xs text-zinc-400">Unassigned</span>
                        ) : (
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[0.6rem] font-semibold text-zinc-700">{initials(t.assignedTo)}</span>
                            <span className="truncate text-zinc-700">{t.assignedTo}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right text-xs text-zinc-500 tabular" title={formatDateTime(t.createdAt)}>
                        {ago(t.createdAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 bg-white px-5 py-2.5 text-sm">
              <span className="text-xs text-zinc-500 tabular">
                {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length.toLocaleString("en-IN")}
              </span>
              <div className="flex gap-1">
                <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)} className="h-7 rounded-md px-2.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)} className="h-7 rounded-md px-2.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
