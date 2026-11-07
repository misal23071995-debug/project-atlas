import Link from "next/link";
import HourlyChart from "./HourlyChart";
import { addDays } from "@/app/lib/reports/period";
import type { DayStats, Split } from "@/app/lib/db/day";

const PRIORITY_COLORS: Record<string, string> = { Urgent: "bg-rose-500", High: "bg-orange-500", Medium: "bg-amber-400", Low: "bg-zinc-400" };
const STATUS_COLORS: Record<string, string> = {
  Open: "bg-sky-500",
  Pending: "bg-amber-400",
  "Waiting on Customer": "bg-zinc-400",
  Escalated: "bg-rose-500",
  Resolved: "bg-emerald-500",
  Closed: "bg-emerald-700",
};

const dayName = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

function minutes(m: number | null) {
  if (m === null) return "—";
  if (m < 60) return `${Math.max(1, Math.round(m))}m`;
  if (m < 24 * 60) return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  return `${Math.floor(m / (24 * 60))}d ${Math.floor((m % (24 * 60)) / 60)}h`;
}

function Change({ now, before, label }: { now: number; before: number; label: string }) {
  if (before === 0) return <span className="text-zinc-500">{now === 0 ? `none ${label}` : `none ${label} either`}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="text-zinc-500">same as {label}</span>;
  // More tickets isn't good or bad by itself, so the change is shown without a colour judgement
  return (
    <span className="text-zinc-600">
      <span aria-hidden>{pct > 0 ? "▲" : "▼"}</span> {Math.abs(pct)}% {pct > 0 ? "more" : "fewer"} than {label} ({before})
    </span>
  );
}

// One horizontal bar per value, with count and share
function Bars({ items, total, colors }: { items: Split[]; total: number; colors?: Record<string, string> }) {
  if (!total) return <p className="text-sm text-zinc-500">No tickets this day.</p>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        return (
          <li key={item.label}>
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-zinc-700">{item.label}</span>
              <span className="shrink-0 tabular text-zinc-900">
                {item.count}
                <span className="ml-1.5 text-xs text-zinc-500">{Math.round((item.count / total) * 100)}%</span>
              </span>
            </span>
            <span className="mt-1 block h-1.5 rounded-full bg-zinc-100">
              <span
                className={`block h-1.5 rounded-full ${colors?.[item.label] ?? "bg-indigo-500"}`}
                style={{ width: `${item.count ? Math.max(2, (item.count / max) * 100) : 0}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DayOverview({ day, today }: { day: DayStats; today: string }) {
  const prev = addDays(day.date, -1);
  const next = addDays(day.date, 1);
  const label = day.isToday ? "Today" : dayName(day.date);
  const prevLabel = day.isToday ? "Yesterday" : dayName(prev);
  const peakHour = day.received ? day.hourly.indexOf(Math.max(...day.hourly)) : null;
  const navButton = "inline-flex h-8 items-center rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-700 hover:bg-zinc-50";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            {label}
            {!day.isToday && <span className="ml-2 text-sm font-normal text-zinc-500">{day.date}</span>}
          </h2>
          <p className="text-sm text-zinc-500">Tickets received, from every channel</p>
        </div>
        <nav className="flex items-center gap-1.5" aria-label="Choose a day">
          <Link href={`/?day=${prev}`} className={navButton} aria-label="Previous day">
            ←
          </Link>
          {!day.isToday && (
            <Link href="/" className={navButton}>
              Today
            </Link>
          )}
          {!day.isToday && (
            <Link href={next >= today ? "/" : `/?day=${next}`} className={navButton} aria-label="Next day">
              →
            </Link>
          )}
          <form action="/" className="ml-1">
            <input
              type="date"
              name="day"
              defaultValue={day.date}
              max={today}
              aria-label="Pick a day"
              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
            />
            <button type="submit" className="sr-only">
              Show
            </button>
          </form>
        </nav>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-600">Tickets received</p>
          <p className="mt-2 text-5xl font-semibold tracking-tight text-zinc-900 tabular">{day.received.toLocaleString("en-IN")}</p>
          <p className="mt-2 text-sm">
            {day.isToday && day.yesterdaySoFar !== null ? (
              <Change now={day.received} before={day.yesterdaySoFar} label="this time yesterday" />
            ) : (
              <Change now={day.received} before={day.yesterday} label={day.isToday ? "yesterday" : prevLabel} />
            )}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-zinc-100 pt-4 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Resolved {day.isToday ? "today" : "that day"}</dt>
              <dd className="mt-0.5 font-semibold tabular text-zinc-900">{day.resolved}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Median first reply</dt>
              <dd className="mt-0.5 font-semibold tabular text-zinc-900">{minutes(day.medianFirstReplyMinutes)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Replied to</dt>
              <dd className="mt-0.5 font-semibold tabular text-zinc-900">
                {day.replied} <span className="font-normal text-zinc-500">of {day.received}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Busiest hour</dt>
              <dd className="mt-0.5 font-semibold tabular text-zinc-900">
                {peakHour === null ? "—" : `${String(peakHour).padStart(2, "0")}:00`}
              </dd>
            </div>
          </dl>
        </section>

        <div className="lg:col-span-2">
          <Card title="By hour">
            <HourlyChart today={day.hourly} yesterday={day.hourlyYesterday} currentHour={day.currentHour} todayLabel={label} yesterdayLabel={prevLabel} />
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="By channel">
          <Bars items={day.byChannel} total={day.received} />
        </Card>
        <Card title="By contact reason">
          <Bars items={day.byCategory} total={day.received} />
        </Card>
        <Card title="By priority">
          <Bars items={day.byPriority} total={day.received} colors={PRIORITY_COLORS} />
        </Card>
        <Card title="Where they stand now">
          <Bars items={day.byStatus.filter((s) => s.count)} total={day.received} colors={STATUS_COLORS} />
        </Card>
      </div>
    </div>
  );
}
