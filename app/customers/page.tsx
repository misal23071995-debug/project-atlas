import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { listCustomers } from "@/app/lib/db/customers";
import { formatDateTime } from "@/app/lib/tickets";
import { initials } from "@/app/lib/auth/agent";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { org } = await requireSession();
  const params = await searchParams;
  const search = String(params.q ?? "").slice(0, 100);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const { items, total, pageSize } = await listCustomers(org.id, { search, page });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const link = (p: number) => `/customers?${new URLSearchParams({ ...(search && { q: search }), page: String(p) })}`;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-zinc-600">
            <span className="tabular text-zinc-800">{total.toLocaleString("en-IN")}</span> {search ? `matching “${search}”` : "people who have contacted you"}
          </p>
        </div>
        <form action="/customers" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search by name or email"
            aria-label="Search customers"
            className="h-9 w-64 max-w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-indigo-500"
          />
          <button type="submit" className="h-9 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800 hover:bg-zinc-100">
            Search
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {items.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-zinc-500">{search ? "Nobody matches that search." : "No customers yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-3 pl-5 pr-4 font-medium sm:pl-6">Customer</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 text-right font-medium">Tickets</th>
                  <th className="px-4 py-3 text-right font-medium">Open</th>
                  <th className="py-3 pl-4 pr-5 font-medium sm:pr-6">Last contact</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="group border-t border-zinc-200 hover:bg-zinc-50">
                    <td className="py-3 pl-5 pr-4 sm:pl-6">
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                          {initials(c.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900 group-hover:text-indigo-700">{c.name}</span>
                          <span className="block truncate text-xs text-zinc-500">{c.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{c.location}</td>
                    <td className="px-4 py-3 text-right tabular text-zinc-700">{c.tickets}</td>
                    <td className="px-4 py-3 text-right tabular">
                      {c.openTickets ? <span className="text-sky-700">{c.openTickets}</span> : <span className="text-zinc-400">0</span>}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-4 pr-5 text-xs text-zinc-500 sm:pr-6">
                      {c.lastContactAt ? formatDateTime(c.lastContactAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 text-sm sm:px-6">
            <span className="text-zinc-500 tabular">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={link(page - 1)} className="rounded-lg px-3 py-1.5 text-zinc-700 hover:bg-zinc-100">
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={link(page + 1)} className="rounded-lg px-3 py-1.5 text-zinc-700 hover:bg-zinc-100">
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
