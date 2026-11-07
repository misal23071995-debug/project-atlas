import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { listLeave, listShifts } from "@/app/lib/db/roster";
import { addDays, isIsoDate, weekStart } from "@/app/lib/roster/types";
import RosterGrid from "./RosterGrid";

export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { agent, org, role } = await requireSession();
  const { week } = await searchParams;

  const today = new Date().toISOString().slice(0, 10);
  const monday = weekStart(isIsoDate(week) ? week : today);
  const sunday = addDays(monday, 6);

  const [members, shifts, leave] = await Promise.all([
    listMembers(org.id),
    listShifts(org.id, monday, sunday),
    listLeave(org.id, { from: monday, to: sunday }),
  ]);

  return (
    <DashboardLayout>
      {shifts === null || leave === null ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Run supabase/migrations/008_roster.sql in the Supabase SQL Editor to turn on the roster.
        </p>
      ) : (
        <RosterGrid
          monday={monday}
          today={today}
          members={members.map((m) => ({ id: m.id, name: m.name, role: m.role }))}
          shifts={shifts}
          leave={leave.filter((l) => l.status === "approved" || l.status === "requested")}
          currentUserId={agent.id}
          canManage={can(role, "roster.manage")}
        />
      )}
    </DashboardLayout>
  );
}
