import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getSlaTargets } from "@/app/lib/db/sla";
import SlaTargetsForm from "./SlaTargetsForm";

export const dynamic = "force-dynamic";

export default async function SlaSettingsPage() {
  const { org, role } = await requireSession();
  const targets = await getSlaTargets(org.id);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">SLA targets</h1>
          <p className="mt-1 text-zinc-600">
            Each ticket gets its due times when it&apos;s created, from its priority. The clocks run around the
            clock (not business hours), and the resolution clock pauses while a ticket is Waiting on Customer.
          </p>
        </div>

        {targets ? (
          <SlaTargetsForm targets={targets} canEdit={can(role, "sla.manage")} />
        ) : (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
            SLA tracking isn&apos;t set up yet. Run supabase/migrations/011_sla.sql in the Supabase SQL Editor.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
