"use client";

import React from "react";

type Props = {
  status: string;
  priority: string;
  assignedTo: string;
  channel: string;
  category: string;
  created: string;
  tags: string[];

  onStatusChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssignedChange: (value: string) => void;
};

export default function TicketInfoCard({
  status,
  priority,
  assignedTo,
  channel,
  category,
  created,
  tags,
  onStatusChange,
  onPriorityChange,
  onAssignedChange,
}: Props) {
  

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-xl font-semibold">
        Ticket Information
      </h2>

      <div className="space-y-5">

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Status</span>

          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1"
          >
            <option>Open</option>
            <option>Pending</option>
            <option>Waiting on Customer</option>
            <option>Escalated</option>
            <option>Resolved</option>
          </select>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-zinc-500">Priority</span>

          <select
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1"
          >
            <option>Urgent</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
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
            className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1"
          >
            <option>Sarah K.</option>
            <option>James L.</option>
            <option>Maria R.</option>
            <option>Priya S.</option>
            <option>Vishal</option>
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