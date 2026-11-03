"use client";

import TicketFilters, { SLA_FILTERS } from "@/app/components/ui/TicketFilters";
import TicketTable from "@/app/components/ui/TicketTable";
import BulkToolbar from "@/app/components/ui/BulkToolbar";
import { useMemo, useState } from "react";
import DashboardLayout from "@/app/components/dashboard-layout";
import { formatDateTime, type Ticket } from "@/app/lib/tickets";
import { useNow } from "@/app/components/useNow";
import { currentClock, isAtRisk, isBreached } from "@/app/lib/sla";


const PAGE_SIZE = 8;
const ALL_STATUSES = "All" as const;
const ALL_PRIORITIES = "All" as const;

type StatusFilter = string;
type PriorityFilter = string;

export default function TicketsView({ tickets }: { tickets: Ticket[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_STATUSES);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(ALL_PRIORITIES);
  const [slaFilter, setSlaFilter] = useState<string>(SLA_FILTERS[0]);
  const [page, setPage] = useState(1);
  const now = useNow();

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    const matches = tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.customer.name.toLowerCase().includes(query) ||
        ticket.assignedTo.toLowerCase().includes(query);

      const matchesStatus = statusFilter === ALL_STATUSES || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === ALL_PRIORITIES || ticket.priority === priorityFilter;

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

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const start = filteredTickets.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filteredTickets.length);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusChange(value: StatusFilter) {
    setStatusFilter(value);
    setPage(1);
  }

  function handlePriorityChange(value: PriorityFilter) {
    setPriorityFilter(value);
    setPage(1);
  }

  function handleSlaChange(value: string) {
    setSlaFilter(value);
    setPage(1);
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Tickets
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Manage and track all customer support tickets.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <TicketFilters
  search={search}
  status={statusFilter}
  priority={priorityFilter}
  sla={slaFilter}
  onSlaChange={handleSlaChange}
  onSearchChange={handleSearchChange}
  onStatusChange={(value) =>
    handleStatusChange(value as StatusFilter)
  }
  onPriorityChange={(value) =>
    handlePriorityChange(value as PriorityFilter)
  }
/>

<BulkToolbar selectedCount={0} />

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

        <div className="flex flex-col gap-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing {start}–{end} of {filteredTickets.length} tickets
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                    pageNum === currentPage
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
