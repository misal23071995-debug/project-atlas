"use client";

import Link from "next/link";
import { PageHeader, StatStrip } from "@/app/components/ui/Panel";
import { useActionState, useState } from "react";
import { gridTotal, type CapacitySettings, type WeekGrid } from "@/app/lib/capacity/model";
import { addDays, formatDay, weekDates } from "@/app/lib/roster/types";
import { saveCapacitySettingsAction, type SettingsFormState } from "./actions";

type View = "gap" | "needed" | "demand";

const VIEWS: { id: View; label: string }[] = [
  { id: "gap", label: "Rostered vs needed" },
  { id: "needed", label: "Agents needed" },
  { id: "demand", label: "Forecast contacts" },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

function gapCell(rostered: number, needed: number) {
  if (needed === 0 && rostered === 0) return { className: "text-zinc-300", title: "No demand, nobody rostered" };
  const gap = rostered - needed;
  if (gap < 0) {
    // Darker red the bigger the shortfall, relative to what's needed
    const share = needed ? -gap / needed : 1;
    const className =
      share > 0.5 ? "bg-rose-200/70 font-medium text-rose-900" : share > 0.25 ? "bg-rose-100 text-rose-800" : "bg-rose-50 text-rose-700";
    return { className, title: `Short by ${fmt(-gap)}` };
  }
  if (gap < 1) return { className: "bg-emerald-50 text-emerald-700", title: "Right on target" };
  return { className: "bg-sky-50 text-sky-700", title: `${fmt(gap)} more than needed` };
}

function heatCell(value: number, max: number) {
  if (value === 0) return "text-zinc-300";
  const share = max ? value / max : 0;
  return share > 0.75
    ? "bg-indigo-500/70 text-white"
    : share > 0.5
    ? "bg-indigo-500/45 text-indigo-900"
    : share > 0.25
    ? "bg-indigo-500/25 text-indigo-900"
    : "bg-indigo-500/10 text-indigo-700";
}

export default function CapacityView({
  monday,
  settings,
  demand,
  needed,
  rostered,
  historyCount,
  rosterReady,
  canManage,
  timeZones,
}: {
  monday: string;
  settings: CapacitySettings;
  demand: WeekGrid;
  needed: WeekGrid;
  rostered: WeekGrid;
  historyCount: number;
  rosterReady: boolean;
  canManage: boolean;
  timeZones: string[];
}) {
  const [view, setView] = useState<View>("gap");
  const [allHours, setAllHours] = useState(false);
  const dates = weekDates(monday);

  // Hide the quiet hours unless asked: show from the first to the last hour with anything in it
  const busyHours = Array.from({ length: 24 }, (_, h) => h).filter((h) =>
    [demand, needed, rostered].some((grid) => grid.some((day) => day[h] > 0))
  );
  const hours =
    allHours || busyHours.length === 0
      ? Array.from({ length: 24 }, (_, h) => h)
      : Array.from({ length: busyHours.at(-1)! - busyHours[0] + 1 }, (_, i) => busyHours[0] + i);

  let shortHours = 0;
  let shortStaffHours = 0;
  let overStaffHours = 0;
  let peak = { day: 0, hour: 0, contacts: 0 };
  demand.forEach((day, d) =>
    day.forEach((contacts, h) => {
      const gap = rostered[d][h] - needed[d][h];
      if (gap < 0) {
        shortHours += 1;
        shortStaffHours += -gap;
      } else if (gap >= 1) overStaffHours += gap;
      if (contacts > peak.contacts) peak = { day: d, hour: h, contacts };
    })
  );

  const grid = view === "needed" ? needed : view === "demand" ? demand : rostered;
  const max = Math.max(...grid.flat(), 0);

  return (
    <>
      <PageHeader
        title="Capacity planning"
        description={
          <>
            How many agents each hour needs to answer {settings.targetPercent}% of contacts within{" "}
            {settings.targetSeconds >= 60 ? `${Math.round(settings.targetSeconds / 60)} min` : `${settings.targetSeconds}s`}, compared with who is on
            the roster. Week of {formatDay(monday)} – {formatDay(addDays(monday, 6))} · {settings.timezone}.
          </>
        }
        actions={
          <div className="flex overflow-hidden rounded-md border border-zinc-200 bg-white text-sm shadow-sm">
            <Link href={`/capacity?week=${addDays(monday, -7)}`} className="px-3 py-1.5 text-zinc-700 hover:bg-zinc-50">
              ← Previous
            </Link>
            <Link href="/capacity" className="border-x border-zinc-200 px-3 py-1.5 font-medium text-zinc-900 hover:bg-zinc-50">
              This week
            </Link>
            <Link href={`/capacity?week=${addDays(monday, 7)}`} className="px-3 py-1.5 text-zinc-700 hover:bg-zinc-50">
              Next →
            </Link>
          </div>
        }
      />

      {settings.useSampleDemand ? (
        <p className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700">
          Showing <strong>sample demand</strong> (about 1,400 contacts a week), not your real tickets.
          {canManage && " Turn it off in the settings below."}
        </p>
      ) : (
        historyCount < 50 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            Only {historyCount} ticket{historyCount === 1 ? "" : "s"} in the last {settings.historyWeeks} weeks, so the
            forecast is thin.{canManage && " Turn on sample demand in the settings below to see how planning works."}
          </p>
        )
      )}
      {!rosterReady && (
        <p className="mb-4 text-sm text-amber-700">Run migration 008 to bring in the roster.</p>
      )}

      <StatStrip
        stats={[
          { label: "Forecast contacts", value: Math.round(gridTotal(demand)).toLocaleString("en-IN"), hint: "this week" },
          {
            label: "Busiest hour",
            value: peak.contacts ? `${DAY_NAMES[peak.day]} ${hourLabel(peak.hour)}` : "—",
            hint: peak.contacts ? `${fmt(peak.contacts)} contacts, ${needed[peak.day][peak.hour]} agents needed` : "no demand",
          },
          {
            label: "Understaffed hours",
            value: <span className={shortHours ? "text-rose-600" : "text-emerald-600"}>{shortHours}</span>,
            hint: `${fmt(Math.round(shortStaffHours * 10) / 10)} agent-hours short`,
          },
          { label: "Spare agent-hours", value: fmt(Math.round(overStaffHours * 10) / 10), hint: "rostered beyond what's needed" },
        ]}
      />

      <section className="mt-4 min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <div className="flex rounded-lg bg-zinc-100 p-0.5" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-3 py-1 text-sm ${view === v.id ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
        {view === "gap" && (
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-200 align-middle" />Short</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-100 align-middle" />On target</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-100 align-middle" />Spare</span>
            <span>Cell: rostered / needed</span>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" checked={allHours} onChange={(e) => setAllHours(e.target.checked)} />
          Show all 24 hours
        </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="w-16 px-3 py-2 text-left font-medium">Hour</th>
              {dates.map((date) => (
                <th key={date} className="px-1 py-2 font-medium">
                  {formatDay(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour} className="border-t border-zinc-100">
                <td className="px-3 py-1 tabular-nums text-zinc-500">{hourLabel(hour)}</td>
                {dates.map((date, day) => {
                  if (view === "gap") {
                    const cell = gapCell(rostered[day][hour], needed[day][hour]);
                    return (
                      <td key={date} title={cell.title} className={`border-l border-white px-1 py-1 text-center tabular-nums ${cell.className}`}>
                        {needed[day][hour] === 0 && rostered[day][hour] === 0
                          ? "·"
                          : `${fmt(rostered[day][hour])} / ${needed[day][hour]}`}
                      </td>
                    );
                  }
                  const value = grid[day][hour];
                  return (
                    <td key={date} className={`border-l border-white px-1 py-1 text-center tabular-nums ${heatCell(value, max)}`}>
                      {value === 0 ? "·" : fmt(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <td className="px-3 py-2 font-medium">Day</td>
              {dates.map((date, day) => {
                const contacts = demand[day].reduce((a, b) => a + b, 0);
                const short = needed[day].reduce((sum, n, h) => sum + Math.max(0, n - rostered[day][h]), 0);
                return (
                  <td key={date} className="px-1 py-2 text-center">
                    <p className="text-zinc-800">{Math.round(contacts)} contacts</p>
                    <p className={short ? "text-rose-600" : "text-emerald-600"}>
                      {short ? `${fmt(Math.round(short * 10) / 10)} agent-h short` : "covered"}
                    </p>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      </section>

      <p className="mt-3 text-xs text-zinc-500">
        Needed = Erlang C agents for {settings.targetPercent}/{settings.targetSeconds}s at {settings.ahtMinutes} min handling
        time, plus {settings.shrinkagePercent}% shrinkage. Rostered = people on shift from the{" "}
        <Link href={`/roster?week=${monday}`} className="text-indigo-600 hover:underline">
          roster
        </Link>
        , minus breaks and approved leave.
      </p>

      {canManage && <SettingsForm settings={settings} timeZones={timeZones} />}
    </>
  );
}


function SettingsForm({ settings, timeZones }: { settings: CapacitySettings; timeZones: string[] }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveCapacitySettingsAction, {});

  return (
    <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Planning settings</h2>
      <form action={action} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-medium text-zinc-700">
            Average handling time (minutes)
            <input type="number" name="ahtMinutes" min={0.1} max={240} step={0.1} defaultValue={settings.ahtMinutes} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Service level target (%)
            <input type="number" name="targetPercent" min={50} max={99} defaultValue={settings.targetPercent} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Answered within (seconds)
            <input type="number" name="targetSeconds" min={10} max={86400} defaultValue={settings.targetSeconds} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Shrinkage (%)
            <input type="number" name="shrinkagePercent" min={0} max={60} defaultValue={settings.shrinkagePercent} className={inputClass} />
            <span className="mt-1 block text-xs text-zinc-500">Meetings, coaching and absence, on top of breaks</span>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Forecast from the last (weeks)
            <input type="number" name="historyWeeks" min={1} max={26} defaultValue={settings.historyWeeks} className={inputClass} />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Time zone
            <select name="timezone" defaultValue={settings.timezone} className={inputClass}>
              {timeZones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="useSampleDemand" defaultChecked={settings.useSampleDemand} className="mt-1" />
          <span>
            Use sample demand
            <span className="block text-xs text-zinc-500">
              A realistic made-up week (about 1,400 contacts) instead of your ticket history. Good for demos and new teams.
            </span>
          </span>
        </label>

        {state.error && <p role="alert" className="text-sm text-rose-600">{state.error}</p>}
        {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </section>
  );
}
