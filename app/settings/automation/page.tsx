import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getAssignmentSettings, listRules } from "@/app/lib/db/automation";
import AutomationView from "./AutomationView";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const { org, role } = await requireSession();
  const [rules, assignment, members] = await Promise.all([listRules(org.id), getAssignmentSettings(org.id), listMembers(org.id)]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Automation</h1>
          <p className="mt-1 text-zinc-600">
            Let the desk do the routine work: give new tickets an owner, set priority, tag, escalate SLA breaches and
            close tickets the customer stopped answering.
          </p>
        </div>

        {rules === null || assignment === null ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
            Automation isn&apos;t set up yet. Run supabase/migrations/014_automation.sql in the Supabase SQL Editor.
          </p>
        ) : (
          <AutomationView
            rules={rules}
            assignment={assignment}
            people={members.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
            canEdit={can(role, "automation.manage")}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
