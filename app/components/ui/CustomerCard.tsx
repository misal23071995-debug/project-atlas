import Link from "next/link";
import { initials } from "@/app/lib/auth/agent";

type CustomerCardProps = {
  id: string;
  name: string;
  email: string;
  customerSince: string;
  location: string;
  device: string;
  // Other tickets from the same person, not counting this one
  otherTickets: number;
};

export default function CustomerCard({ id, name, email, customerSince, location, device, otherTickets }: CustomerCardProps) {
  const rows = [
    ["Customer since", customerSince],
    ["Location", location],
    ["Device", device],
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-700">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-zinc-900">{name}</p>
          <p className="truncate text-sm text-zinc-600" title={email}>
            {email}
          </p>
        </div>
      </div>

      <dl className="mt-5 space-y-2.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="truncate text-zinc-800">{value}</dd>
          </div>
        ))}
      </dl>

      <Link
        href={`/customers/${id}`}
        className="mt-5 flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50"
      >
        <span>Full history{otherTickets ? ` · ${otherTickets} other ticket${otherTickets === 1 ? "" : "s"}` : ""}</span>
        <span aria-hidden className="text-zinc-500">→</span>
      </Link>
    </div>
  );
}
