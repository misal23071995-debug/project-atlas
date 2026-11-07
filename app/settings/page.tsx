import Link from "next/link";
import { headers } from "next/headers";
import DashboardLayout from "@/app/components/dashboard-layout";
import { PageHeader, Panel } from "@/app/components/ui/Panel";
import { requireSession } from "@/app/lib/auth/session";
import { can, ROLE_LABELS } from "@/app/lib/auth/roles";
import { CopyLink, PasswordForm, ProfileForm, WorkspaceForm } from "./forms";
import { countDemoTickets } from "@/app/lib/db/demo";
import DemoData from "./DemoData";
import TwoFactorCard from "./TwoFactorCard";
import { getAuthClient } from "@/app/lib/auth/session";

export const dynamic = "force-dynamic";
// Loading demo data writes a few thousand rows, which takes longer than the default limit
export const maxDuration = 120;

// A shortcut to one of the settings pages
function Tile({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:border-indigo-300">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-zinc-900 group-hover:text-indigo-700">
        {title}
        <span aria-hidden className="text-zinc-400 group-hover:text-indigo-600">
          →
        </span>
      </span>
      <span className="mt-1 text-xs leading-5 text-zinc-500">{description}</span>
    </Link>
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
  const { data: factors } = await (await getAuthClient()).auth.mfa.listFactors();
  const twoFactorOn = (factors?.totp?.length ?? 0) > 0;

  return (
    <DashboardLayout>
      <PageHeader title="Settings" description={`${org.name} · you're ${role === "admin" ? "an" : "a"} ${ROLE_LABELS[role]}`} />

      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Support setup</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile href="/settings/sla" title="SLA targets" description="How fast the team should reply to and resolve tickets of each priority." />
        <Tile href="/settings/automation" title="Automation" description="Assign new tickets automatically and set rules for priority, tags, escalation and closing." />
        {can(role, "email.manage") && <Tile href="/settings/email" title="Email" description="Turn customer emails into tickets and reply by email." />}
        <Tile href="/settings/replies" title="Saved replies" description="Ready-made answers agents insert into tickets." />
        <Tile
          href="/settings/team"
          title="Team"
          description={can(role, "team.manage") ? "Add people and choose their roles." : "See who is in this workspace."}
        />
        {can(role, "audit.view") && (
          <Tile href="/settings/audit" title="Audit log" description="Who changed the team, sign-in security, settings, rules and orders." />
        )}
      </div>

      <div className="mt-8 grid items-start gap-x-4 gap-y-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Workspace</h2>
          <Panel title="Customer chat link" description="Put this on your website or help centre. Anyone can open it.">
            <CopyLink url={chatUrl} />
          </Panel>
          {canManageWorkspace && (
            <Panel title="Company">
              <WorkspaceForm name={org.name} />
            </Panel>
          )}
          {canManageWorkspace && (
            <Panel title="Demo data" description="For demos and interviews">
              <DemoData demoTickets={demoTickets} />
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900">Your account</h2>
          <Panel title="Profile" description={agent.email}>
            <ProfileForm name={agent.name} />
          </Panel>
          <Panel title="Password">
            <PasswordForm />
          </Panel>
          <Panel title="Two-step sign-in" description="A code from your phone each time you sign in, on top of your password.">
            <TwoFactorCard enabled={twoFactorOn} />
          </Panel>
        </div>
      </div>
    </DashboardLayout>
  );
}
