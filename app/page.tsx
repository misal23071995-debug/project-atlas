import Link from "next/link";
import { after } from "next/server";
import DashboardLayout from "./components/dashboard-layout";
import { sweepTimedRules } from "@/app/lib/db/automation";
import { requireSession } from "./lib/auth/session";
import { getDashboardStats } from "./lib/db/dashboard";
import { getBotStats } from "./lib/db/bot";
import { getDayStats } from "./lib/db/day";
import { getCapacitySettings } from "./lib/db/capacity";
import { DEFAULT_SETTINGS } from "./lib/capacity/model";
import { localDate } from "./lib/reports/period";
import DayOverview from "./components/ui/DayOverview";
import type { TicketPriority } from "./lib/tickets";
import { ChannelLabel, StatusBadge } from "./components/ui/Badges";
import { initials } from "./lib/auth/agent";

// Always show the current state of the queue
export const dynamic = "force-dynamic";

const priorityColors: Record<TicketPriority, string> = {
  Urgent: "bg-rose-500",
  High: "bg-orange-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};


function formatDuration(minutes: number) {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(minutes / (24 * 60))}d ${Math.floor((minutes % (24 * 60)) / 60)}h`;
}

function formatStars(average: number | null) {
  return average === null ? "—" : `${average.toFixed(1)} ★`;
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / (24 * 60))} d ago`;
}

// A white panel with a titled header bar; flush lets lists and tables run edge to edge
function Panel({
  title,
  action,
  className = "",
  flush = false,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {action}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { agent, org } = await requireSession();
  // SLA-breach and waiting rules are checked in the background, after the page is sent
  after(() => sweepTimedRules(org.id));

  // Days are counted in the team's time zone, the same one the roster and capacity plan use
  const timezone = (await getCapacitySettings(org.id))?.timezone ?? DEFAULT_SETTINGS.timezone;
  const today = localDate(Date.parse(new Date().toISOString()), timezone);
  const asked = (await searchParams).day;
  const dayDate = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;

  const [stats, botStats, day] = await Promise.all([
    getDashboardStats(org.id),
    getBotStats(org.id),
    getDayStats(org.id, dayDate, timezone),
  ]);
  const firstName = agent?.name.split(" ")[0];
  const now = stats.generatedAt;

  // The live queue, whatever day is shown above
  const queue = [
    { label: "Open", value: stats.open, href: "/tickets", tone: "text-zinc-900" },
    { label: "Unassigned", value: stats.unassigned, href: "/tickets", tone: stats.unassigned ? "text-amber-700" : "text-zinc-900" },
    { label: "Urgent or high", value: stats.needsAttention, href: "/tickets", tone: "text-zinc-900" },
    { label: "Escalated", value: stats.escalated, href: "/tickets", tone: stats.escalated ? "text-rose-700" : "text-zinc-900" },
    { label: "Past SLA", value: stats.slaBreached, href: "/tickets", tone: stats.slaBreached ? "text-rose-700" : "text-zinc-900" },
    { label: "SLA at risk", value: stats.slaAtRisk, href: "/tickets", tone: stats.slaAtRisk ? "text-amber-700" : "text-zinc-900" },
  ];

  const maxAgentLoad = Math.max(1, ...stats.byAgent.map((a) => a.open + a.resolved));

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Good to see you{firstName ? `, ${firstName}` : ""}. Here&apos;s how support is going.
          </p>
        </div>
        <Link href="/reports" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Full reports →
        </Link>
      </div>

      <DayOverview day={day} today={today} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Right now</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {queue.map((item) => (
            <Link key={item.label} href={item.href} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:border-indigo-300">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular ${item.tone}`}>{item.value}</p>
            </Link>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Average first reply over all tickets: {stats.avgFirstResponseMinutes === null ? "—" : formatDuration(stats.avgFirstResponseMinutes)}
          {stats.slaMetPercent !== null && ` · SLA met on ${stats.slaMetPercent}% in the last 7 days`}
        </p>
      </section>

      <div className="mt-8 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Recently updated"
          className="xl:col-span-2"
          action={
            <Link href="/tickets" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
              Open inbox →
            </Link>
          }
          flush
        >
          {stats.recent.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No tickets yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {stats.recent.map((t) => (
                <li key={t.id}>
                  <Link href={`/tickets/${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">{t.subject}</p>
                      <p className="truncate text-xs text-zinc-500">
                        <span className="font-mono">#{t.id}</span> · {t.customer} · {t.assignedTo}
                      </p>
                    </div>
                    <span className="hidden sm:block">
                      <ChannelLabel channel={t.channel} />
                    </span>
                    <StatusBadge status={t.status} />
                    <span className="w-16 shrink-0 text-right text-xs text-zinc-500 tabular">{timeAgo(t.updatedAt, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open backlog by priority">
          {stats.open === 0 ? (
            <p className="text-sm text-zinc-500">Nothing open. Nice.</p>
          ) : (
            <>
              <p className="text-3xl font-semibold tabular text-zinc-900">
                {stats.open}
                <span className="ml-1.5 text-sm font-normal text-zinc-500">open</span>
              </p>
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
                {stats.backlogByPriority
                  .filter((b) => b.count)
                  .map((b) => (
                    <span key={b.priority} className={priorityColors[b.priority]} style={{ width: `${(b.count / stats.open) * 100}%` }} title={`${b.priority}: ${b.count}`} />
                  ))}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {stats.backlogByPriority.map((b) => (
                  <li key={b.priority} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-zinc-700">
                      <span className={`h-2 w-2 rounded-full ${priorityColors[b.priority]}`} aria-hidden />
                      {b.priority}
                    </span>
                    <span className="tabular text-zinc-900">{b.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="AI chatbot · last 30 days"
          className="xl:col-span-2"
          action={
            <span className="flex gap-3 text-xs font-medium">
              <Link href="/knowledge/gaps" className="text-indigo-600 hover:text-indigo-700">
                Knowledge gaps
              </Link>
              <a href={`/support/${org.slug}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700">
                Customer chat ↗
              </a>
            </span>
          }
        >
          {botStats === null ? (
            <p className="text-sm text-zinc-500">Run supabase/migrations/003_support_bot.sql in Supabase to turn on the chatbot.</p>
          ) : botStats.conversations === 0 ? (
            <p className="text-sm text-zinc-500">No customer chats yet. Open the customer chat to try it.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "Chats", value: botStats.conversations.toLocaleString("en-IN") },
                    { label: "Solved by the bot", value: `${botStats.deflectionRate}%`, tone: "text-emerald-700" },
                    { label: "Handed to agents", value: botStats.handedOff.toLocaleString("en-IN") },
                    { label: "Chat CSAT", value: formatStars(botStats.csat.average) },
                  ].map((item) => (
                    <div key={item.label}>
                      <dt className="text-xs text-zinc-500">{item.label}</dt>
                      <dd className={`mt-1 text-2xl font-semibold tabular ${item.tone ?? "text-zinc-900"}`}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  CSAT when the bot solved it: <span className="font-medium text-zinc-900">{formatStars(botStats.csat.averageResolvedByBot)}</span> · after a handover:{" "}
                  <span className="font-medium text-zinc-900">{formatStars(botStats.csat.averageHandedOff)}</span> · {botStats.csat.responseRate}% of chats rated
                </p>
              </div>
              <div className="lg:col-span-2">
                <p className="mb-2 text-xs font-medium text-zinc-500">Top topics</p>
                <ul className="space-y-2">
                  {botStats.topTopics.map((item) => {
                    const top = botStats.topTopics[0]?.count || 1;
                    return (
                      <li key={item.topic}>
                        <span className="flex justify-between text-sm">
                          <span className="truncate text-zinc-700">{item.topic}</span>
                          <span className="tabular text-zinc-900">{item.count}</span>
                        </span>
                        <span className="mt-1 block h-1.5 rounded-full bg-zinc-100">
                          <span className="block h-1.5 rounded-full bg-indigo-500" style={{ width: `${(item.count / top) * 100}%` }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Agent workload" flush>
          {stats.byAgent.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No tickets are assigned yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pl-5 text-left font-medium">Agent</th>
                  <th className="px-3 py-2 text-right font-medium">Open</th>
                  <th className="py-2 pl-3 pr-5 text-right font-medium">Resolved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.byAgent.map((a) => (
                  <tr key={a.name}>
                    <td className="py-2.5 pl-5">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[0.6rem] font-semibold text-zinc-700">{initials(a.name)}</span>
                        <span className="truncate text-zinc-800">{a.name}</span>
                      </span>
                      <span className="mt-1.5 block h-1 rounded-full bg-zinc-100">
                        <span className="block h-1 rounded-full bg-indigo-500" style={{ width: `${((a.open + a.resolved) / maxAgentLoad) * 100}%` }} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-zinc-900">{a.open}</td>
                    <td className="py-2.5 pl-3 pr-5 text-right tabular text-zinc-500">{a.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}
