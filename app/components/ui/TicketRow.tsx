import Link from "next/link";
import SlaBadge from "./SlaBadge";
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
  
  export default function TicketRow({
    id,
    subject,
    customer,
    channel,
    priority,
    status,
    agent,
    updated,
    sla,
  }: TicketRowProps) {
    return (
      <tr className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
        <td className="px-4 py-4">
          <input type="checkbox" className="h-4 w-4" />
        </td>
  
        <td className="px-4 py-4">
        <Link
  href={`/tickets/${id}`}
  className="font-semibold text-indigo-500 hover:text-indigo-400 hover:underline transition-colors"
>
  {id}
</Link>
  
          <p className="text-sm text-zinc-400">
            {subject}
          </p>
        </td>
  
        <td className="px-4 py-4">
          <div>
            <p className="font-medium">
              {customer}
            </p>
  
            <p className="text-xs text-zinc-500">
              Customer
            </p>
          </div>
        </td>
  
        <td className="px-4 py-4">
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs">
            {channel}
          </span>
        </td>
  
        <td className="px-4 py-4">
          <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs">
            {priority}
          </span>
        </td>
  
        <td className="px-4 py-4">
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs">
            {status}
          </span>
        </td>
  
        <td className="px-4 py-4">
          <SlaBadge ticket={sla} />
        </td>

        <td className="px-4 py-4">
          {agent}
        </td>
  
        <td className="px-4 py-4 text-zinc-500">
          {updated}
        </td>
      </tr>
    );
  }