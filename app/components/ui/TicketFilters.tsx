"use client";

import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/app/lib/tickets";

type TicketFiltersProps = {
  search: string;
  status: string;
  priority: string;
  sla: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onSlaChange: (value: string) => void;
};

export const SLA_FILTERS = ["All SLAs", "Breached", "At risk", "Paused"] as const;

export default function TicketFilters({
  search,
  status,
  priority,
  sla,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onSlaChange,
}: TicketFiltersProps) {
  return (
    <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
        />

        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option>All</option>
          {TICKET_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option>All</option>
          {TICKET_PRIORITIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select
          value={sla}
          onChange={(e) => onSlaChange(e.target.value)}
          aria-label="SLA"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          {SLA_FILTERS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
    </div>
  );
}