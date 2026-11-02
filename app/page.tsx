"use client";

import DashboardLayout from "./components/dashboard-layout";
import { useAgent } from "./components/AgentProvider";

const kpis = [
  {
    title: "Open Tickets",
    value: "142",
    change: "+12%",
    trend: "up",
    subtext: "vs last week",
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: "🎫",
  },
  {
    title: "SLA Breach Risk",
    value: "18",
    change: "-9%",
    trend: "down",
    subtext: "needs attention today",
    accent: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    icon: "⚠️",
  },
  {
    title: "CSAT",
    value: "94.2%",
    change: "+2.4%",
    trend: "up",
    subtext: "rolling 7 days",
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    icon: "⭐",
  },
  {
    title: "Avg First Response",
    value: "2m 48s",
    change: "-11%",
    trend: "down",
    subtext: "all channels combined",
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    icon: "⏱️",
  },
];

const channelData = [
  { channel: "Chat", volume: 486, sla: "96%", color: "bg-blue-500" },
  { channel: "Email", volume: 212, sla: "91%", color: "bg-violet-500" },
  { channel: "Voice", volume: 74, sla: "89%", color: "bg-emerald-500" },
  { channel: "Social", volume: 58, sla: "93%", color: "bg-amber-500" },
];

const backlogData = [
  { priority: "Urgent", count: 14, color: "bg-rose-500" },
  { priority: "High", count: 37, color: "bg-orange-500" },
  { priority: "Medium", count: 61, color: "bg-amber-500" },
  { priority: "Low", count: 30, color: "bg-emerald-500" },
];

const recentTickets = [
  {
    id: "#4821",
    subject: "Login issue on mobile app",
    customer: "Rahul Sharma",
    channel: "Chat",
    owner: "Sarah K.",
    status: "Open",
    time: "5 min ago",
  },
  {
    id: "#4819",
    subject: "Billing discrepancy for March",
    customer: "Aditi Mehra",
    channel: "Email",
    owner: "James L.",
    status: "Pending",
    time: "23 min ago",
  },
  {
    id: "#4815",
    subject: "Feature request: export report",
    customer: "Ankit Verma",
    channel: "Voice",
    owner: "Maria R.",
    status: "Resolved",
    time: "1 hr ago",
  },
  {
    id: "#4812",
    subject: "Unable to sync wearable data",
    customer: "Sneha Nair",
    channel: "Chat",
    owner: "Priya S.",
    status: "Open",
    time: "2 hr ago",
  },
];

const topAgents = [
  { name: "Sarah K.", resolved: 48, csat: 97, occupancy: 84 },
  { name: "James L.", resolved: 42, csat: 94, occupancy: 78 },
  { name: "Maria R.", resolved: 39, csat: 96, occupancy: 81 },
  { name: "Priya S.", resolved: 35, csat: 95, occupancy: 76 },
];

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "Open"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
      : status === "Pending"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{status}</span>;
}

export default function Home() {
  const firstName = useAgent()?.name.split(" ")[0];

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
            Here’s a live view of your ticket queue, SLA health, and agent performance across support channels.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Queue Health</p>
            <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">Stable</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Agents Online</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">22 / 26</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Backlog</p>
            <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">142</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Escalations</p>
            <p className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">9</p>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg ${item.accent}`}>
                {item.icon}
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  item.trend === "up"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                }`}
              >
                {item.change}
              </span>
            </div>

            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{item.title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{item.value}</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{item.subtext}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Tickets</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Latest customer conversations and queue movement
              </p>
            </div>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
              View all
            </button>
          </div>

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
                {recentTickets.map((ticket) => (
                  <tr key={ticket.id} className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40">
                    <td className="rounded-l-xl px-4 py-4 align-middle">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{ticket.id}</p>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{ticket.subject}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.customer}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.channel}</td>
                    <td className="px-4 py-4 text-sm text-zinc-900 dark:text-zinc-50">{ticket.owner}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="rounded-r-xl px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                      {ticket.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Backlog by Priority</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Current ticket distribution across urgency levels
          </p>

          <div className="mt-6 space-y-4">
            {backlogData.map((item) => {
              const total = 142;
              const width = (item.count / total) * 100;

              return (
                <div key={item.priority}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{item.priority}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{item.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Channel Performance</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Volume and SLA adherence by support channel
          </p>

          <div className="mt-6 space-y-5">
            {channelData.map((item) => {
              const width = Math.min((item.volume / 500) * 100, 100);

              return (
                <div key={item.channel}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.channel}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.volume} tickets today</p>
                    </div>
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.sla} SLA</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className={`h-2.5 rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Agents</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Resolved volume, CSAT and occupancy snapshot
          </p>

          <div className="mt-6 space-y-4">
            {topAgents.map((agent) => (
              <div key={agent.name} className="rounded-xl border border-zinc-100 p-4 dark:border-zinc-800">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{agent.name}</p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {agent.resolved} tickets resolved today
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{agent.csat}% CSAT</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{agent.occupancy}% occupancy</p>
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${agent.csat}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}