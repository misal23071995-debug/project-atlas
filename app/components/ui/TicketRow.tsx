import Link from "next/link";
import SlaBadge from "./SlaBadge";
import { ChannelLabel, PriorityBadge, StatusBadge } from "./Badges";
import type { TicketSla } from "@/app/lib/sla";

type TicketRowProps = {
  id: string;
  subject: string;
  customer: string;
  channel: string;
  priority: string;
  status: string;
  agent: string;
  updated: string;
  sla: TicketSla;
};

export default function TicketRow({ id, subject, customer, channel, priority, status, agent, updated, sla }: TicketRowProps) {
  return (
    <tr className="group border-t border-zinc-800/80 transition-colors hover:bg-zinc-800/40">
      <td className="max-w-0 py-3 pl-5 pr-4 sm:pl-6">
        <Link href={`/tickets/${id}`} className="block focus:outline-none">
          <span className="flex items-baseline gap-2">
            <span className="font-mono text-xs text-indigo-300 group-hover:text-indigo-200">#{id}</span>
            <span className="truncate font-medium text-zinc-100">{subject}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-zinc-500">
            {customer} · <span className="tabular">{updated}</span>
          </span>
        </Link>
      </td>
      <td className="px-4 py-3"><ChannelLabel channel={channel} /></td>
      <td className="px-4 py-3"><PriorityBadge priority={priority} /></td>
      <td className="px-4 py-3"><StatusBadge status={status} /></td>
      <td className="px-4 py-3"><SlaBadge ticket={sla} /></td>
      <td className="truncate whitespace-nowrap py-3 pl-4 pr-5 text-sm text-zinc-300 sm:pr-6">
        {agent === "Unassigned" ? <span className="text-zinc-500">Unassigned</span> : agent}
      </td>
    </tr>
  );
}
