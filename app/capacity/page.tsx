import DashboardLayout from "@/app/components/dashboard-layout";
import { requireSession } from "@/app/lib/auth/session";
import { can } from "@/app/lib/auth/roles";
import { getCapacitySettings, ticketTimes } from "@/app/lib/db/capacity";
import { listLeave, listShifts } from "@/app/lib/db/roster";
import {
  forecastFromHistory,
  previousSunday,
  rosterCoverage,
  sampleDemand,
  staffNeeded,
} from "@/app/lib/capacity/model";
import { addDays, isIsoDate, weekStart } from "@/app/lib/roster/types";
import CapacityView from "./CapacityView";

export const dynamic = "force-dynamic";

export default async function CapacityPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { org, role } = await requireSession();
  const { week } = await searchParams;

  const settings = await getCapacitySettings(org.id);
  if (!settings) {
    return (
      <DashboardLayout>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Run supabase/migrations/009_capacity.sql in the Supabase SQL Editor to turn on capacity planning.
        </p>
      </DashboardLayout>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const monday = weekStart(isIsoDate(week) ? week : today);

  const [history, shifts, leave] = await Promise.all([
    settings.useSampleDemand ? Promise.resolve([]) : ticketTimes(org.id, settings.historyWeeks),
    // From the Sunday before, so overnight shifts into Monday morning count
    listShifts(org.id, previousSunday(monday), addDays(monday, 6)),
    listLeave(org.id, { from: previousSunday(monday), to: addDays(monday, 6) }),
  ]);

  const demand = settings.useSampleDemand
    ? sampleDemand()
    : forecastFromHistory(history, settings.timezone, settings.historyWeeks);

  return (
    <DashboardLayout>
      <CapacityView
        monday={monday}
        settings={settings}
        demand={demand}
        needed={staffNeeded(demand, settings)}
        rostered={rosterCoverage(monday, shifts ?? [], leave ?? [])}
        historyCount={history.length}
        rosterReady={shifts !== null}
        canManage={can(role, "capacity.manage")}
        timeZones={Intl.supportedValuesOf("timeZone")}
      />
    </DashboardLayout>
  );
}
