"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import TicketFilters, { SLA_FILTERS } from "@/app/components/ui/TicketFilters";
import TicketTable from "@/app/components/ui/TicketTable";
import DashboardLayout from "@/app/components/dashboard-layout";
import { useCan } from "@/app/components/AgentProvider";
import { formatDateTime, type Ticket } from "@/app/lib/tickets";
import { useNow } from "@/app/components/useNow";
import { currentClock, isAtRisk, isBreached, isDone } from "@/app/lib/sla";

const PAGE_SIZE = 12;
const ALL = "All";

export default function TicketsView({ tickets }: { tickets: Ticket[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [slaFilter, setSlaFilter] = useState<string>(SLA_FILTERS[0]);
  const [page, setPage] = useState(1);
  const now = useNow();
  const canWork = useCan("tickets.work");

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.customer.name.toLowerCase().includes(query) ||
        ticket.assignedTo.toLowerCase().includes(query);

      const matchesStatus = statusFilter === ALL || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === ALL || ticket.priority === priorityFilter;

      const matchesSla =
        slaFilter === SLA_FILTERS[0] ||
        now === null ||
        (slaFilter === "Breached" && isBreached(ticket, now)) ||
        (slaFilter === "At risk" && isAtRisk(ticket, now)) ||
        (slaFilter === "Paused" && ticket.slaPausedAt !== null);

      return matchesSearch && matchesStatus && matchesPriority && matchesSla;
    });

    // With an SLA filter on, show what's due soonest (or most overdue) first
    if (slaFilter === SLA_FILTERS[0] || now === null) return matches;
    const minutesLeft = (ticket: Ticket) => currentClock(ticket, now).clock?.minutesLeft ?? Infinity;
    return [...matches].sort((a, b) => minutesLeft(a) - minutesLeft(b));
  }, [tickets, search, statusFilter, priorityFilter, slaFilter, now]);

  // Quick counts for the header, from the whole queue rather than the filtered view
  const counts = useMemo(() => {
    const open = tickets.filter((t) => !isDone(t.status));
    return {
      open: open.length,
      unassigned: open.filter((t) => t.assignedTo === "Unassigned").length,
      breached: now === null ? null : open.filter((t) => isBreached(t, now)).length,
    };
  }, [tickets, now]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const start = filteredTickets.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filteredTickets.length);

  // Changing a filter starts again from the first page
  const filterSetter = (set: (value: string) => void) => (value: string) => {
    set(value);
    setPage(1);
  };

  // A short window of page numbers around the current one
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1
  );

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">Tickets</h1>
          <p className="mt-1 text-sm text-zinc-400">
            <span className="tabular text-zinc-200">{counts.open}</span> open ·{" "}
            <span className="tabular text-zinc-200">{counts.unassigned}</span> unassigned
            {counts.breached !== null && (
              <>
                {" "}·{" "}
                <button
                  type="button"
                  onClick={() => filterSetter(setSlaFilter)("Breached")}
                  className={counts.breached ? "text-rose-300 underline-offset-2 hover:underline" : ""}
                >
                  <span className="tabular">{counts.breached}</span> past SLA
                </button>
              </>
            )}
          </p>
        </div>
        {canWork && (
          <Link
            href="/tickets/new"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-700 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
          >
            Log a phone or walk-in ticket
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <TicketFilters
          search={search}
          status={statusFilter}
          priority={priorityFilter}
          sla={slaFilter}
          onSearchChange={filterSetter(setSearch)}
          onStatusChange={filterSetter(setStatusFilter)}
          onPriorityChange={filterSetter(setPriorityFilter)}
          onSlaChange={filterSetter(setSlaFilter)}
        />

        <TicketTable
          tickets={paginatedTickets.map((ticket) => ({
            id: ticket.id,
            subject: ticket.subject,
            customer: ticket.customer.name,
            channel: ticket.channel,
            priority: ticket.priority,
            status: ticket.status,
            agent: ticket.assignedTo,
            updated: formatDateTime(ticket.createdAt),
            sla: ticket,
          }))}
        />

        <div className="flex flex-col gap-3 border-t border-zinc-800 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-zinc-500 tabular">
            {start}–{end} of {filteredTickets.length.toLocaleString("en-IN")}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="h-8 rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            {pageNumbers.map((n, i) => (
              <span key={n} className="flex items-center">
                {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="px-1 text-zinc-600">…</span>}
                <button
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === currentPage ? "page" : undefined}
                  className={`h-8 min-w-8 rounded-lg px-2 text-sm tabular ${
                    n === currentPage ? "bg-indigo-600 text-white" : "text-zinc-400 hover:bg-zinc-800"
                  }`}
                >
                  {n}
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="h-8 rounded-lg px-3 text-sm text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
