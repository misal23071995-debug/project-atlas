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
          <Link href="/settings" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">Automation</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
            Let the desk do the routine work: give new tickets an owner, set priority, tag, escalate SLA breaches and
            close tickets the customer stopped answering.
          </p>
        </div>

        {rules === null || assignment === null ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
