import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { AUDIT_ACTIONS, listAudit, type AuditAction } from "@/app/lib/audit";
import { formatDateTime } from "@/app/lib/tickets";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "", label: "Everything" },
  { id: "member", label: "Team" },
  { id: "security", label: "Sign-in security" },
  { id: "automation", label: "Automation" },
  { id: "order", label: "Orders" },
  { id: "email", label: "Email" },
  { id: "sla", label: "SLA" },
  { id: "quality", label: "Quality" },
  { id: "demo", label: "Demo data" },
];

// The useful bits of the details, in words
function describe(details: Record<string, unknown>) {
  const parts: string[] = [];
  if (typeof details.role === "string") parts.push(`role ${details.role}`);
  if (details.from && details.to) parts.push(`${details.from} → ${details.to}`);
  if (typeof details.enabled === "boolean") parts.push(details.enabled ? "turned on" : "turned off");
  if (typeof details.mode === "string") parts.push(`mode ${details.mode.replace("_", " ")}`);
  if (typeof details.total === "number") parts.push(`₹${details.total.toLocaleString("en-IN")}`);
  if (typeof details.ticketId === "string") parts.push(`on ticket #${details.ticketId}`);
  if (typeof details.via === "string") parts.push(`via ${details.via}`);
  if (typeof details.method === "string") parts.push(details.method);
  return parts.join(" · ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { org, role } = await requireSession();
  if (!can(role, "audit.view")) {
    return (
      <DashboardLayout>
        <p className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-600 shadow-sm">The audit log is for workspace admins.</p>
      </DashboardLayout>
    );
  }

  const requested = (await searchParams).type ?? "";
  const type = FILTERS.some((f) => f.id === requested) ? requested : "";
  const entries = await listAudit(org.id, { action: type || undefined });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/settings" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">Audit log</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">Who changed what in {org.name}: the team, sign-in security, settings, rules and orders. Latest 200.</p>
        </div>

        <nav className="flex flex-wrap gap-2" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id ? `/settings/audit?type=${f.id}` : "/settings/audit"}
              className={`rounded-full px-3 py-1 text-sm ${type === f.id ? "bg-indigo-600 text-white" : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {entries === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The audit log isn&apos;t set up yet. Run supabase/migrations/017_audit_log.sql in the Supabase SQL Editor.
          </p>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow-sm">Nothing recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-zinc-500">
                    <th className="py-3 pl-5 pr-4 font-medium sm:pl-6">When</th>
                    <th className="px-4 py-3 font-medium">Who</th>
                    <th className="py-3 pl-4 pr-5 font-medium sm:pr-6">What</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-zinc-200 align-top">
                      <td className="whitespace-nowrap py-3 pl-5 pr-4 text-xs text-zinc-500 tabular sm:pl-6">{formatDateTime(e.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-800">{e.actorName}</td>
                      <td className="py-3 pl-4 pr-5 sm:pr-6">
                        <p className="text-zinc-900">
                          {AUDIT_ACTIONS[e.action as AuditAction] ?? e.action}
                          {e.target && <span className="text-zinc-600">: {e.target}</span>}
                        </p>
                        {describe(e.details) && <p className="mt-0.5 text-xs text-zinc-500">{describe(e.details)}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
