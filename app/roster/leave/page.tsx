import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { listLeave } from "@/app/lib/db/roster";
import LeaveView from "./LeaveView";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const { agent, org, role } = await requireSession();
  const canManage = can(role, "roster.manage");

  // Leads see the whole team's leave; everyone else only their own
  const [members, leave] = await Promise.all([
    listMembers(org.id),
    listLeave(org.id, canManage ? {} : { userId: agent.id }),
  ]);
  const names = new Map(members.map((m) => [m.id, m.name]));

  return (
    <DashboardLayout>
      <Link href="/roster" className="text-sm text-zinc-600 hover:text-zinc-800">
        ← Roster
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Leave</h1>
      <p className="mt-1 text-zinc-600">
        {canManage
          ? "Approve or reject requests. Approved leave shows on the roster, and any shift on those days is flagged."
          : "Ask for time off. Your team lead approves it, and it shows on the roster."}
      </p>

      {leave === null ? (
        <p className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          Run supabase/migrations/008_roster.sql in the Supabase SQL Editor to turn on leave requests.
        </p>
      ) : (
        <LeaveView
          leave={leave.map((l) => ({ ...l, userName: names.get(l.userId) ?? "Former member" }))}
          currentUserId={agent.id}
          canManage={canManage}
        />
      )}
    </DashboardLayout>
  );
}
