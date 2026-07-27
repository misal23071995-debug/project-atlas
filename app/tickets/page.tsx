"use client";

import TicketFilters from "@/app/components/ui/TicketFilters";
import TicketTable from "@/app/components/ui/TicketTable";
import BulkToolbar from "@/app/components/ui/BulkToolbar";
import { useMemo, useState } from "react";
import DashboardLayout from "@/app/components/dashboard-layout";
import { tickets } from "@/app/lib/data/tickets";


const PAGE_SIZE = 8;
const ALL_STATUSES = "All" as const;
const ALL_PRIORITIES = "All" as const;

type StatusFilter = string;
type PriorityFilter = string;

export default function TicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_STATUSES);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(ALL_PRIORITIES);
  const [page, setPage] = useState(1);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.customer.toLowerCase().includes(query) ||
        ticket.assignedTo.toLowerCase().includes(query);

      const matchesStatus = statusFilter === ALL_STATUSES || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === ALL_PRIORITIES || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [search, statusFilter, priorityFilter]);

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
    customer: ticket.customer,
    channel: ticket.channel,
    priority: ticket.priority,
    status: ticket.status,
    agent: ticket.assignedTo,
    updated: ticket.created,
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
