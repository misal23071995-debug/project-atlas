import Link from "next/link";
import { headers } from "next/headers";
import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getEmailSettings } from "@/app/lib/db/email";
import { emailConnection } from "@/app/lib/email/provider";
import { EmailSettingsForm, InboundAddress, TestInbox } from "./EmailForms";

export const dynamic = "force-dynamic";
// The test inbox reads each email with the AI
export const maxDuration = 60;

function Section({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {description && <div className="mt-1 text-sm text-zinc-600">{description}</div>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function EmailSettingsPage() {
  const { org, role } = await requireSession();
  const canManage = can(role, "email.manage");

  if (!canManage) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold">Email</h1>
          <p className="mt-2 text-zinc-600">Email settings are for admins and team leads.</p>
        </div>
      </DashboardLayout>
    );
  }

  const settings = await getEmailSettings(org.id);
  const connection = emailConnection();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/settings" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Settings
          </Link>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900">Email</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">
            Customer emails become tickets in the inbox. Replies on email tickets go back to the customer by email,
            and a customer&apos;s reply lands on the same ticket.
          </p>
        </div>

        {!settings ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Email isn&apos;t set up yet. Run supabase/migrations/013_email.sql in the Supabase SQL Editor.
          </p>
        ) : (
          <>
            <Section
              title="Sending"
              description={
                connection ? (
                  <span className="text-emerald-600">Connected through {connection.provider}, sending from {connection.from}.</span>
                ) : (
                  <span>
                    <span className="text-amber-700">Not connected.</span>{" "}
                    Replies are saved on the ticket and marked
                    &ldquo;not emailed&rdquo;. To send real email, create a free Resend account, verify your company&apos;s
                    domain, then add RESEND_API_KEY and EMAIL_FROM (for example support@yourcompany.com) to the
                    project&apos;s environment variables in Vercel.
                  </span>
                )
              }
            >
              <EmailSettingsForm settings={settings} workspaceName={org.name} />
            </Section>

            <Section
              title="Receiving"
              description={
                <>
                  Point your email provider&apos;s incoming-mail webhook at this address. Postmark&apos;s inbound format
                  works as it is; anything else can post JSON with from, subject and text. Keep it private: anyone with
                  it can create tickets.
                </>
              }
            >
              <InboundAddress
                url={`${protocol}://${host}/api/email/inbound/${settings.inboundKey}`}
                canRegenerate={can(role, "workspace.manage")}
              />
            </Section>

            <Section
              title="Test inbox"
              description="Send a pretend customer email through the same steps a real one takes. Good for demos."
            >
              <TestInbox />
            </Section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
