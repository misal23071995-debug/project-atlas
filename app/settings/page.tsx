import Link from "next/link";
import { headers } from "next/headers";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can, ROLE_LABELS } from "@/app/lib/auth/roles";
import { CopyLink, PasswordForm, ProfileForm, WorkspaceForm } from "./forms";
import { countDemoTickets } from "@/app/lib/db/demo";
import DemoData from "./DemoData";

export const dynamic = "force-dynamic";
// Loading demo data writes a few thousand rows, which takes longer than the default limit
export const maxDuration = 120;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const { agent, org, role } = await requireSession();
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const chatUrl = `${protocol}://${host}/support/${org.slug}`;
  const canManageWorkspace = can(role, "workspace.manage");
  const demoTickets = canManageWorkspace ? await countDemoTickets(org.id) : 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-zinc-400">
            {org.name} · you&apos;re {role === "admin" ? "an" : "a"} {ROLE_LABELS[role]}
          </p>
        </div>

        <Section title="Customer chat link" description="Put this on your website or help centre. Anyone can open it.">
          <CopyLink url={chatUrl} />
        </Section>

        {can(role, "workspace.manage") && (
          <Section title="Workspace">
            <WorkspaceForm name={org.name} />
          </Section>
        )}

        <Section
          title="SLA targets"
          description="How fast the team should reply to and resolve tickets of each priority."
        >
          <Link href="/settings/sla" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            {can(role, "sla.manage") ? "Edit SLA targets →" : "See SLA targets →"}
          </Link>
        </Section>

        <Section
          title="Team"
          description={can(role, "team.manage") ? "Add people and choose their roles." : "See who is in this workspace."}
        >
          <Link href="/settings/team" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            Open team →
          </Link>
        </Section>

        {canManageWorkspace && (
          <Section title="Demo data" description="For demos and interviews">
            <DemoData demoTickets={demoTickets} />
          </Section>
        )}

        <Section title="Your profile" description={agent.email}>
          <ProfileForm name={agent.name} />
        </Section>

        <Section title="Password">
          <PasswordForm />
        </Section>
      </div>
    </DashboardLayout>
  );
}
