import Link from "next/link";
import DashboardLayout from "./components/dashboard-layout";
import { getCurrentAgent } from "./lib/auth/session";
import { getDashboardStats } from "./lib/db/dashboard";
import { getBotStats } from "./lib/db/bot";
import type { TicketPriority, TicketStatus } from "./lib/tickets";

// Always show the current state of the queue
export const dynamic = "force-dynamic";

const priorityColors: Record<TicketPriority, string> = {
  Urgent: "bg-rose-500",
  High: "bg-orange-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

const channelColors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500"];

function formatDuration(minutes: number) {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(minutes / (24 * 60))}d ${Math.floor((minutes % (24 * 60)) / 60)}h`;
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / (24 * 60))} d ago`;
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const styles =
    status === "Open"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
      : status === "Escalated"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
      : status === "Resolved" || status === "Closed"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";

  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{status}</span>;
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">{children}</p>;
}

export default async function Home() {
  const [agent, stats, botStats] = await Promise.all([
    getCurrentAgent(),
    getDashboardStats(),
    getBotStats(),
  ]);
  const firstName = agent?.name.split(" ")[0];
  const now = stats.generatedAt;

  const kpis = [
    {
      title: "Open Tickets",
      value: String(stats.open),
      subtext: "not yet resolved or closed",
      accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      icon: "🎫",
    },
    {
      title: "Needs Attention",
      value: String(stats.needsAttention),
      subtext: "open with Urgent or High priority",
      accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      icon: "⚠️",
    },
    {
      title: "Resolved",
      value: String(stats.resolvedThisWeek),
      subtext: "resolved or closed in the last 7 days",
      accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      icon: "✅",
    },
    {
      title: "Avg First Response",
      value: stats.avgFirstResponseMinutes === null ? "—" : formatDuration(stats.avgFirstResponseMinutes),
      subtext: "time to the first agent reply",
      accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      icon: "⏱️",
    },
  ];

  const headerStats = [
    { label: "New (24h)", value: stats.newToday, color: "text-zinc-900 dark:text-zinc-50" },
    { label: "Unassigned", value: stats.unassigned, color: "text-zinc-900 dark:text-zinc-50" },
    { label: "Backlog", value: stats.open, color: "text-zinc-900 dark:text-zinc-50" },
    { label: "Escalations", value: stats.escalated, color: "text-amber-600 dark:text-amber-400" },
  ];

  const maxChannelTotal = Math.max(1, ...stats.byChannel.map((c) => c.total));
  const maxAgentLoad = Math.max(1, ...stats.byAgent.map((a) => a.open + a.resolved));

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
            Support operations overview
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Here’s a live view of your ticket queue, workload and response times across support channels.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {headerStats.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
              <p className={`mt-1 text-lg font-semibold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${item.accent}`}>
              {item.icon}
            </div>

            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{item.title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{item.value}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{item.subtext}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">AI Chatbot</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Customer chats in the last 30 days, and how many needed an agent
            </p>
          </div>
          <Link
            href="/support"
            target="_blank"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Open customer chat ↗
          </Link>
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
                { label: "Deflection rate", value: `${botStats.deflectionRate}%`, color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Handled by AI", value: botStats.resolvedByBot, color: "text-zinc-900 dark:text-zinc-50" },
                { label: "Handed to agent", value: botStats.handedOff, color: "text-amber-600 dark:text-amber-400" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/40">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
              <p className="col-span-3 text-xs text-zinc-400 dark:text-zinc-500">
                Deflection rate = chats the AI handled without creating a ticket, out of {botStats.conversations} chats.
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Top topics</p>
              <ul className="mt-3 space-y-2 text-sm">
                {botStats.topTopics.map((item) => (
                  <li key={item.topic} className="flex justify-between text-zinc-600 dark:text-zinc-300">
                    <span>{item.topic}</span>
                    <span className="text-zinc-400">{item.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Tickets</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Most recently updated conversations
              </p>
            </div>
            <Link
              href="/tickets"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
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
                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
                    <tr key={ticket.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                      <td className="rounded-l-xl px-4 py-4 align-middle">
                        <Link href={`/tickets/${ticket.id}`} className="group block">
                          <p className="text-sm font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-50 dark:group-hover:text-indigo-400">
                            #{ticket.id}
                          </p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{ticket.subject}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.customer}</td>
                      <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.channel}</td>
                      <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.assignedTo}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="whitespace-nowrap rounded-r-xl px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {timeAgo(ticket.updatedAt, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Backlog by Priority</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Open tickets by urgency
          </p>

          <div className="mt-6 space-y-4">
            {stats.backlogByPriority.map((item) => {
              const width = stats.open ? (item.count / stats.open) * 100 : 0;

              return (
                <div key={item.priority}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.priority}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{item.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Channels</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Where tickets come from, and how many are still open
          </p>

          {stats.byChannel.length === 0 ? (
            <EmptyNote>No tickets yet.</EmptyNote>
          ) : (
            <div className="mt-6 space-y-5">
              {stats.byChannel.map((item, index) => (
                <div key={item.channel}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.channel}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {item.total} {item.total === 1 ? "ticket" : "tickets"}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.open} open</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-2.5 rounded-full ${channelColors[index % channelColors.length]}`}
                      style={{ width: `${(item.total / maxChannelTotal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Agent Workload</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Tickets assigned to each agent
          </p>

          {stats.byAgent.length === 0 ? (
            <EmptyNote>No tickets are assigned yet.</EmptyNote>
          ) : (
            <div className="mt-6 space-y-4">
              {stats.byAgent.map((item) => (
                <div key={item.name} className="rounded-xl border border-zinc-100 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.name}</p>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.open} open</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.resolved} resolved</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
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
