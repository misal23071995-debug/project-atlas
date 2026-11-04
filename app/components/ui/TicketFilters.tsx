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

const control =
  "h-9 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-200 outline-none transition-colors focus:border-indigo-500";

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
    <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:px-6 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search tickets</span>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Search by number, subject, customer or agent"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`${control} w-full pl-9`}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex">
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} aria-label="Status" className={control}>
          <option value="All">All statuses</option>
          {TICKET_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select value={priority} onChange={(e) => onPriorityChange(e.target.value)} aria-label="Priority" className={control}>
          <option value="All">All priorities</option>
          {TICKET_PRIORITIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        <select value={sla} onChange={(e) => onSlaChange(e.target.value)} aria-label="SLA" className={control}>
          {SLA_FILTERS.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
