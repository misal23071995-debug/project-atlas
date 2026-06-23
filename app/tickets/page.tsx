"use client";

import { useMemo, useState } from "react";
import DashboardLayout from "../components/dashboard-layout";
import {
  formatDate,
  mockTickets,
  priorityStyles,
  statusStyles,
  type TicketPriority,
  type TicketStatus,
} from "../lib/tickets";

const PAGE_SIZE = 8;
const ALL_STATUSES = "All" as const;
const ALL_PRIORITIES = "All" as const;

type StatusFilter = typeof ALL_STATUSES | TicketStatus;
type PriorityFilter = typeof ALL_PRIORITIES | TicketPriority;

export default function TicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_STATUSES);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(ALL_PRIORITIES);
  const [page, setPage] = useState(1);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return mockTickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.customerName.toLowerCase().includes(query) ||
        ticket.assignedAgent.toLowerCase().includes(query);

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
        <div className="flex flex-col gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="search"
              placeholder="Search tickets, customers, agents..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value={ALL_STATUSES}>All Statuses</option>
              <option value="Open">Open</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityChange(e.target.value as PriorityFilter)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value={ALL_PRIORITIES}>All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Ticket ID</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Subject</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Customer Name</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Status</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Priority</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Assigned Agent</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:px-6">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    No tickets match your filters.
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-indigo-600 dark:text-indigo-400 sm:px-6">
                      {ticket.id}
                    </td>
                    <td className="max-w-xs truncate px-4 py-4 text-zinc-900 dark:text-zinc-100 sm:px-6">
                      {ticket.subject}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-700 dark:text-zinc-300 sm:px-6">
                      {ticket.customerName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[ticket.status]}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityStyles[ticket.priority]}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-700 dark:text-zinc-300 sm:px-6">
                      {ticket.assignedAgent}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-zinc-500 dark:text-zinc-400 sm:px-6">
                      {formatDate(ticket.createdDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
