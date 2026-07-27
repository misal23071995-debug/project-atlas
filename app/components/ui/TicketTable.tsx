import TicketRow from "./TicketRow";

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  channel: string;
  priority: string;
  status: string;
  agent: string;
  updated: string;
};

type TicketTableProps = {
  tickets: Ticket[];
};

export default function TicketTable({ tickets }: TicketTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800">
            <tr>
              <th className="px-4 py-4"></th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Ticket
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Customer
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Channel
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Priority
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Status
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Agent
              </th>

              <th className="px-4 py-4 text-left text-sm font-semibold">
                Updated
              </th>
            </tr>
          </thead>

          <tbody>
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.id}
                {...ticket}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}