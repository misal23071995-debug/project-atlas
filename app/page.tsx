"use client";

import DashboardLayout from "./components/dashboard-layout";

const stats = [
  {
    title: "Open Tickets",
    value: "142",
    change: "+12%",
    trend: "up" as const,
    description: "vs last week",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 0 1-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 1 1-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 0 1 6.336-4.486l-3.276 3.276a3.004 3.004 0 0 0 2.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852Z" />
      </svg>
    ),
    accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "Pending Tickets",
    value: "38",
    change: "-5%",
    trend: "down" as const,
    description: "vs last week",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    title: "Resolved Tickets",
    value: "1,284",
    change: "+18%",
    trend: "up" as const,
    description: "vs last week",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Average Response Time",
    value: "2h 14m",
    change: "-8%",
    trend: "down" as const,
    description: "vs last week",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
];

export default function Home() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Welcome back, Vishal
        </h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Here&apos;s what&apos;s happening with your support queue today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <div className={`rounded-lg p-2.5 ${stat.accent}`}>{stat.icon}</div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  stat.trend === "up"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">{stat.title}</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{stat.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            {[
              { ticket: "#4821", subject: "Login issue on mobile app", agent: "Sarah K.", time: "5 min ago", status: "Open" },
              { ticket: "#4819", subject: "Billing discrepancy for March", agent: "James L.", time: "23 min ago", status: "Pending" },
              { ticket: "#4815", subject: "Feature request: dark mode export", agent: "Maria R.", time: "1 hr ago", status: "Resolved" },
            ].map((item) => (
              <div
                key={item.ticket}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {item.ticket} — {item.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.agent} · {item.time}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.status === "Open"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      : item.status === "Pending"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Team Performance</h2>
          <div className="mt-4 space-y-5">
            {[
              { name: "Sarah K.", resolved: 48, satisfaction: 97 },
              { name: "James L.", resolved: 42, satisfaction: 94 },
              { name: "Maria R.", resolved: 39, satisfaction: 96 },
            ].map((agent) => (
              <div key={agent.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">{agent.resolved} resolved</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${agent.satisfaction}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {agent.satisfaction}% satisfaction
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
