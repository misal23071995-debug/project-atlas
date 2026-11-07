"use client";

import React from "react";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/app/lib/tickets";

type Props = {
  status: string;
  priority: string;
  assignedTo: string;
  agentNames: string[];
  channel: string;
  category: string;
  created: string;
  tags: string[];
  // For roles that can read tickets but not change them
  readOnly?: boolean;

  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssignedChange: (value: string) => void;
};

export default function TicketInfoCard({
  status,
  priority,
  assignedTo,
  agentNames,
  channel,
  category,
  created,
  tags,
  readOnly = false,
  onStatusChange,
  onPriorityChange,
  onAssignedChange,
}: Props) {
  // Keep an older assignee visible even if that name has no account
  const assigneeOptions = ["Unassigned", ...agentNames];
  if (!assigneeOptions.includes(assignedTo)) assigneeOptions.push(assignedTo);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-6 text-xl font-semibold">
        Ticket details
      </h2>

      <div className="space-y-5">

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Status</span>

          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={readOnly}
            className="rounded-md bg-zinc-100 border border-zinc-300 px-3 py-1 disabled:opacity-60"
          >
            {TICKET_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Priority</span>

          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            disabled={readOnly}
            className="rounded-md bg-zinc-100 border border-zinc-300 px-3 py-1 disabled:opacity-60"
          >
            {[...TICKET_PRIORITIES].reverse().map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Channel</span>
          <span>{channel}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Category</span>
          <span>{category}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Created</span>
          <span>{created}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Assigned To</span>

          <select
            value={assignedTo}
            onChange={(e) => onAssignedChange(e.target.value)}
            disabled={readOnly}
            className="rounded-md bg-zinc-100 border border-zinc-300 px-3 py-1 disabled:opacity-60"
          >
            {assigneeOptions.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-zinc-500">
            Tags
          </p>

          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}