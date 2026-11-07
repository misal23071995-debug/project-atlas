import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard-layout";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { AddMemberForm, MemberRow, RoleGuide } from "../forms";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { agent, org, role } = await requireSession();
  const members = await listMembers(org.id);
  const canManage = can(role, "team.manage");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link href="/settings" className="text-sm text-zinc-600 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Team</h1>
          <p className="mt-1 text-zinc-600">
            {members.length} {members.length === 1 ? "person" : "people"} in {org.name}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-white text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow key={member.id} member={member} isYou={member.id === agent.id} canManage={canManage} />
              ))}
            </tbody>
          </table>
        </div>

        {canManage && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Add a team member</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Creates their login with a temporary password. Share it with them privately.
            </p>
            <div className="mt-5">
              <AddMemberForm />
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold">What each role can do</h2>
          <div className="mt-4">
            <RoleGuide />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
