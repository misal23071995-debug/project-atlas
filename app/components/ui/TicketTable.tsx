import TicketRow from "./TicketRow";
import type { TicketSla } from "@/app/lib/sla";

type Ticket = {
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

const HEADERS = ["Channel", "Priority", "Status", "SLA"];

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  if (!tickets.length) {
    return <p className="px-6 py-16 text-center text-sm text-zinc-500">No tickets match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] table-fixed text-left">
        <colgroup>
          <col />
          <col className="w-28" />
          <col className="w-24" />
          <col className="w-40" />
          <col className="w-40" />
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            <th className="py-3 pl-5 pr-4 font-medium sm:pl-6">Ticket</th>
            {HEADERS.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">{h}</th>
            ))}
            <th className="py-3 pl-4 pr-5 font-medium sm:pr-6">Agent</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} {...ticket} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
