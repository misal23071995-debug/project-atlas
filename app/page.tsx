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

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-zinc-600">{children}</p>;
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

  const maxChannelTotal = Math.max(1, ...stats.byChannel.map((c) => c.total));
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

      <section className="mt-8 min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">AI Chatbot</h2>
            <p className="text-sm text-zinc-600">
              Customer chats in the last 30 days, and how many needed an agent
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/knowledge/gaps"
              className="text-sm font-medium hover:text-indigo-500 text-indigo-600"
            >
              Knowledge gaps
            </Link>
            <Link
              href={`/support/${org.slug}`}
              target="_blank"
              className="text-sm font-medium hover:text-indigo-500 text-indigo-600"
            >
              Open customer chat ↗
            </Link>
          </div>
        </div>

        {botStats === null ? (
          <EmptyNote>
            Run supabase/migrations/003_support_bot.sql in Supabase to turn on the chatbot.
          </EmptyNote>
        ) : botStats.conversations === 0 ? (
          <EmptyNote>No customer chats yet. Open the customer chat to try it.</EmptyNote>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="grid grid-cols-3 gap-3 lg:col-span-2">
              {[
                { label: "Deflection rate", value: `${botStats.deflectionRate}%`, color: "text-emerald-600" },
                { label: "Handled by AI", value: botStats.resolvedByBot, color: "text-zinc-900" },
                { label: "Handed to agent", value: botStats.handedOff, color: "text-amber-600" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl p-4 bg-zinc-50">
                  <p className="text-xs text-zinc-600">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
              <p className="col-span-3 text-xs text-zinc-500">
                Deflection rate = chats the AI handled without creating a ticket, out of {botStats.conversations} chats.
              </p>

              <div className="col-span-3 grid grid-cols-3 gap-3 border-t pt-4 border-zinc-200">
                {[
                  {
                    label: "Chat CSAT",
                    value: formatStars(botStats.csat.average),
                    note: `${botStats.csat.responses} ratings · ${botStats.csat.responseRate}% response rate`,
                  },
                  { label: "CSAT when AI solved it", value: formatStars(botStats.csat.averageResolvedByBot) },
                  { label: "CSAT after handover", value: formatStars(botStats.csat.averageHandedOff) },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-zinc-600">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-zinc-900">{item.value}</p>
                    {item.note && <p className="mt-0.5 text-xs text-zinc-500">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-900">Top topics</p>
              <ul className="mt-3 space-y-2 text-sm">
                {botStats.topTopics.map((item) => (
                  <li key={item.topic} className="flex justify-between text-zinc-700">
                    <span>{item.topic}</span>
                    <span className="text-zinc-600">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Recent tickets</h2>
              <p className="text-sm text-zinc-600">
                Most recently updated conversations
              </p>
            </div>
            <Link
              href="/tickets"
              className="text-sm font-medium hover:text-indigo-500 text-indigo-600"
            >
              View all
            </Link>
          </div>

          {stats.recent.length === 0 ? (
            <EmptyNote>No tickets yet.</EmptyNote>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-600">
                    <th className="pb-2 font-medium">Ticket</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Owner</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent.map((ticket) => (
                    <tr key={ticket.id} className="rounded-xl bg-zinc-50">
                      <td className="rounded-l-xl px-4 py-4 align-middle">
                        <Link href={`/tickets/${ticket.id}`} className="group block">
                          <p className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-600">
                            #{ticket.id}
                          </p>
                          <p className="text-sm text-zinc-600">{ticket.subject}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-900">{ticket.customer}</td>
                      <td className="px-4 py-4"><ChannelLabel channel={ticket.channel} /></td>
                      <td className="px-4 py-4 text-sm text-zinc-900">{ticket.assignedTo}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="whitespace-nowrap rounded-r-xl px-4 py-4 text-sm text-zinc-600">
                        {timeAgo(ticket.updatedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Backlog by priority</h2>
          <p className="text-sm text-zinc-600">
            Open tickets by urgency
          </p>

          <div className="mt-6 space-y-4">
            {stats.backlogByPriority.map((item) => {
              const width = stats.open ? (item.count / stats.open) * 100 : 0;

              return (
                <div key={item.priority}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-900">{item.priority}</span>
                    <span className="text-zinc-600">{item.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-zinc-100">
                    <div
                      className={`h-2.5 rounded-full ${priorityColors[item.priority]}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Channels</h2>
          <p className="text-sm text-zinc-600">
            Where tickets come from, and how many are still open
          </p>

          {stats.byChannel.length === 0 ? (
            <EmptyNote>No tickets yet.</EmptyNote>
          ) : (
            <div className="mt-6 space-y-5">
              {stats.byChannel.map((item) => (
                <div key={item.channel}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-zinc-900">{item.channel}</p>
                      <p className="text-xs text-zinc-600">
                        {item.total} {item.total === 1 ? "ticket" : "tickets"}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-zinc-900">{item.open} open</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-zinc-100">
                    <div
                      className="h-2.5 rounded-full bg-indigo-500"
                      style={{ width: `${(item.total / maxChannelTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Agent workload</h2>
          <p className="text-sm text-zinc-600">
            Tickets assigned to each agent
          </p>

          {stats.byAgent.length === 0 ? (
            <EmptyNote>No tickets are assigned yet.</EmptyNote>
          ) : (
            <div className="mt-6 space-y-4">
              {stats.byAgent.map((item) => (
                <div key={item.name} className="rounded-xl border p-4 border-zinc-200">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-zinc-900">{item.name}</p>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900">{item.open} open</p>
                      <p className="text-xs text-zinc-600">{item.resolved} resolved</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-zinc-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${((item.open + item.resolved) / maxAgentLoad) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </DashboardLayout>
  );
}
