import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getCapacitySettings } from "@/app/lib/db/capacity";
import { getReport } from "@/app/lib/db/reports";
import { resolvePeriod } from "@/app/lib/reports/period";
import { DEFAULT_SETTINGS } from "@/app/lib/capacity/model";
import ReportsView from "./ReportsView";

export const dynamic = "force-dynamic";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { org, role } = await requireSession();

  if (!can(role, "reports.view")) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="mt-2 text-zinc-400">
            Team reports are for admins, team leads and QA analysts. Your own quality results and training are on the
            Quality and Training pages.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const params = await searchParams;
  // Days are counted in the team's time zone, the same one capacity planning uses
  const timezone = (await getCapacitySettings(org.id))?.timezone ?? DEFAULT_SETTINGS.timezone;
  const period = resolvePeriod({ range: first(params.range), from: first(params.from), to: first(params.to) }, timezone);
  const report = await getReport(org.id, period);

  return <ReportsView report={report} period={period} workspaceName={org.name} />;
}
