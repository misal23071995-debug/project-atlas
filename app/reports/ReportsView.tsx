"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import DashboardLayout from "@/app/components/dashboard-layout";
import type { Report, Summary } from "@/app/lib/db/reports";
import { downloadCsv, type Cell } from "@/app/lib/reports/csv";
import { PRESETS, type Period } from "@/app/lib/reports/period";
import { formatMinutes } from "@/app/lib/sla";

// Validated for colour-blind separation on the dark surface (zinc-900)
const CREATED_COLOR = "#6366f1";
const RESOLVED_COLOR = "#059669";
const BAR_COLOR = "#6366f1";

const duration = (minutes: number | null) => (minutes === null ? "—" : formatMinutes(minutes));
const pct = (value: number | null) => (value === null ? "—" : `${value}%`);
const num = (value: number | null) => (value === null ? "—" : value.toLocaleString("en-IN"));
const csvMinutes = (minutes: number | null) => (minutes === null ? null : Math.round(minutes));

// ---- Building blocks ----

function Section({
  title,
  description,
  onExport,
  children,
}: {
  title: string;
  description?: string;
  onExport?: () => void;
  children: ReactNode;
}) {
  return (
    // min-w-0 lets wide tables scroll inside the card instead of stretching the page
    <section className="min-w-0 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Download CSV
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Table({ header, rows, empty }: { header: string[]; rows: ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="min-w-full text-sm">
        <thead className="text-left text-zinc-600">
          <tr>
            {header.map((h, i) => (
              <th key={h} className={`whitespace-nowrap px-5 py-2 font-medium sm:px-6 ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-zinc-200">
              {row.map((cell, i) => (
                <td key={i} className={`whitespace-nowrap px-5 py-2.5 sm:px-6 ${i ? "text-right tabular-nums" : "font-medium"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Change against the previous period. `better` says which direction is good, if any.
function Delta({ now, before, better }: { now: number | null; before: number | null; better?: "up" | "down" }) {
  if (now === null || before === null) return <span className="text-zinc-500">no earlier data</span>;
  if (before === 0) return <span className="text-zinc-500">{now === 0 ? "no change" : "new"}</span>;

  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return <span className="text-zinc-500">no change</span>;

  const up = change > 0;
  const good = better === undefined ? null : (better === "up") === up;
  const tone = good === null ? "text-zinc-600" : good ? "text-emerald-600" : "text-rose-600";
  return (
    <span className={tone}>
      <span aria-hidden>{up ? "▲" : "▼"}</span> {Math.abs(change)}%{good === null ? "" : good ? " better" : " worse"}
    </span>
  );
}

function Tile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
      <p className="mt-2 text-xs">{delta}</p>
    </div>
  );
}

// One horizontal bar per row, for shares and percentages
function Meter({ value, max = 100 }: { value: number; max?: number }) {
  return (
    <div className="h-2 w-28 rounded-full bg-zinc-100">
      <div
        className="h-2 rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: BAR_COLOR }}
      />
    </div>
  );
}

function niceMax(value: number) {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10].map((s) => s * magnitude);
  return steps.find((s) => s >= value) ?? 10 * magnitude;
}

// Created vs resolved per day or week, with a tooltip per bucket and a table view
function TrendChart({ points, step }: { points: Report["trend"]; step: "day" | "week" }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const width = 720;
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 26, left: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.created, p.resolved))));
  const slot = plotW / Math.max(1, points.length);
  const bar = Math.max(2, Math.min(24, (slot - 6) / 2));
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const every = Math.ceil(points.length / 8);
  const ticks = [0, max / 2, max];

  // A 4px rounded top, square at the baseline
  const column = (x: number, value: number) => {
    const top = y(value);
    const h = pad.top + plotH - top;
    if (h <= 0) return "";
    const r = Math.min(4, h, bar / 2);
    return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + bar - r} Q${x + bar},${top} ${x + bar},${top + r} V${top + h} Z`;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CREATED_COLOR }} /> Created
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: RESOLVED_COLOR }} /> Resolved
          </span>
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="text-indigo-600 hover:text-indigo-700">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {asTable ? (
        <Table
          header={[step === "week" ? "Week" : "Day", "Created", "Resolved"]}
          rows={points.map((p) => [p.label, p.created, p.resolved])}
          empty="No days in this period."
        />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Tickets created and resolved over time">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
                <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const x0 = pad.left + i * slot + (slot - (bar * 2 + 2)) / 2;
              return (
                <g key={p.label}>
                  {hover === i && <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="#e2e8f0" opacity={0.6} />}
                  <path d={column(x0, p.created)} fill={CREATED_COLOR} />
                  <path d={column(x0 + bar + 2, p.resolved)} fill={RESOLVED_COLOR} />
                  {i % every === 0 && (
                    <text x={pad.left + i * slot + slot / 2} y={height - 8} textAnchor="middle" fontSize={11} fill="#64748b">
                      {p.label.replace("Week of ", "")}
                    </text>
                  )}
                  {/* Hit target: the whole slot, taller and wider than the bars */}
                  <rect
                    x={pad.left + i * slot}
                    y={pad.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((pad.left + hover * slot + slot / 2) / width) * 100}%` }}
            >
              <p className="font-medium text-zinc-900">{points[hover].label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-zinc-700">
                <span className="h-2 w-2 rounded-sm" style={{ background: CREATED_COLOR }} /> Created {points[hover].created}
              </p>
              <p className="flex items-center gap-1.5 text-zinc-700">
                <span className="h-2 w-2 rounded-sm" style={{ background: RESOLVED_COLOR }} /> Resolved {points[hover].resolved}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Page ----

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-indigo-500";

export default function ReportsView({
  report,
  period,
  workspaceName,
}: {
  report: Report;
  period: Period;
  workspaceName: string;
}) {
  const { summary: s, previous: p } = report;
  const file = (name: string) => `${workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${name}-${period.fromDate}-to-${period.toDate}.csv`;
  const exportTable = (name: string, header: string[], rows: Cell[][]) => () => downloadCsv(file(name), header, rows);
  const compare = `vs the ${period.days} days before`;

  const summaryRows = (label: string, x: Summary): Cell[] => [
    label,
    x.created,
    x.resolved,
    csvMinutes(x.avgFirstResponseMinutes),
    csvMinutes(x.medianFirstResponseMinutes),
    csvMinutes(x.avgResolutionMinutes),
    csvMinutes(x.medianResolutionMinutes),
    x.slaMetPercent,
    x.ticketCsatAverage,
    x.csatAverage,
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="mt-1 text-zinc-600">
              {period.label} · {period.fromDate} to {period.toDate} · days in {period.timezone}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
              <Link
                key={preset.id}
                href={`/reports?range=${preset.id}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  period.id === preset.id ? "bg-indigo-600 text-white" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {preset.label.replace("Last ", "")}
              </Link>
            ))}
            <form action="/reports" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="range" value="custom" />
              <input type="date" name="from" defaultValue={period.fromDate} aria-label="From" className={inputClass} />
              <span className="text-zinc-500">to</span>
              <input type="date" name="to" defaultValue={period.toDate} aria-label="To" className={inputClass} />
              <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
                Apply
              </button>
            </form>
          </div>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Tickets created" value={num(s.created)} delta={<Delta now={s.created} before={p.created} />} />
          <Tile label="Resolved" value={num(s.resolved)} delta={<Delta now={s.resolved} before={p.resolved} better="up" />} />
          <Tile
            label="First reply (median)"
            value={duration(s.medianFirstResponseMinutes)}
            sub={`Average ${duration(s.avgFirstResponseMinutes)}`}
            delta={<Delta now={s.medianFirstResponseMinutes} before={p.medianFirstResponseMinutes} better="down" />}
          />
          <Tile
            label="Resolution (median)"
            value={duration(s.medianResolutionMinutes)}
            sub={`Average ${duration(s.avgResolutionMinutes)}`}
            delta={<Delta now={s.medianResolutionMinutes} before={p.medianResolutionMinutes} better="down" />}
          />
          <Tile
            label="SLA met"
            value={pct(s.slaMetPercent)}
            sub={`${num(s.slaClocks)} reply and resolution targets`}
            delta={<Delta now={s.slaMetPercent} before={p.slaMetPercent} better="up" />}
          />
          <Tile
            label="CSAT"
            value={s.ticketCsatAverage === null ? "—" : `${s.ticketCsatAverage} ★`}
            sub={`${num(s.ticketCsatResponses)} ticket ratings · bot chats ${s.csatAverage === null ? "—" : `${s.csatAverage} ★`}`}
            delta={<Delta now={s.ticketCsatAverage} before={p.ticketCsatAverage} better="up" />}
          />
        </div>
        <p className="-mt-3 text-xs text-zinc-500">Changes are {compare}.</p>

        {/* Right now */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Open now", value: num(report.backlog.open) },
            { label: "SLA breached", value: num(report.backlog.breached), tone: report.backlog.breached ? "text-rose-600" : "" },
            { label: "SLA at risk", value: num(report.backlog.atRisk), tone: report.backlog.atRisk ? "text-amber-600" : "" },
            { label: "Unassigned", value: num(report.backlog.unassigned) },
            { label: "Oldest open", value: duration(report.backlog.oldestOpenMinutes) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-xs text-zinc-500">{item.label}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums ${item.tone ?? ""}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <Section
          title="Volume"
          description={`Tickets created and resolved per ${report.trendStep}`}
          onExport={exportTable(
            "volume",
            [report.trendStep === "week" ? "Week" : "Day", "Created", "Resolved"],
            report.trend.map((t) => [t.label, t.created, t.resolved])
          )}
        >
          <TrendChart points={report.trend} step={report.trendStep} />
        </Section>

        <Section
          title="Agents"
          description="Resolved tickets are counted for whoever holds the ticket; first reply time for whoever sent it."
          onExport={exportTable(
            "agents",
            ["Agent", "Resolved", "Replies", "Open now", "Avg first reply (min)", "SLA met %", "CSAT", "CSAT ratings", "QC average", "QC reviews", "Training passed", "Training overdue"],
            report.agents.map((a) => [
              a.name,
              a.resolved,
              a.replies,
              a.openNow,
              csvMinutes(a.avgFirstResponseMinutes),
              a.slaMetPercent,
              a.csatAverage,
              a.csatResponses,
              a.qcAverage,
              a.qcReviews,
              a.trainingPassed,
              a.trainingOverdue,
            ])
          )}
        >
          <Table
            header={["Agent", "Resolved", "Replies", "Open now", "Avg first reply", "SLA met", "CSAT", "QC score", "Training"]}
            rows={report.agents.map((a) => [
              a.name,
              a.resolved,
              a.replies,
              a.openNow,
              duration(a.avgFirstResponseMinutes),
              pct(a.slaMetPercent),
              a.csatAverage === null ? "—" : `${a.csatAverage} ★ (${a.csatResponses})`,
              a.qcAverage === null ? "—" : `${a.qcAverage}% (${a.qcReviews})`,
              a.trainingOverdue ? (
                <span className="text-rose-600">{a.trainingOverdue} overdue</span>
              ) : a.trainingPassed ? (
                `${a.trainingPassed} passed`
              ) : (
                "—"
              ),
            ])}
            empty="Nobody worked tickets in this period."
          />
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section
            title="SLA by priority"
            description="Share of reply and resolution targets met"
            onExport={exportTable(
              "sla-by-priority",
              ["Priority", "Created", "Open now", "First reply met %", "Resolution met %"],
              report.byPriority.map((r) => [r.priority, r.created, r.open, r.replyMetPercent, r.resolveMetPercent])
            )}
          >
            <Table
              header={["Priority", "Created", "Open now", "First reply met", "Resolution met"]}
              rows={report.byPriority.map((r) => [r.priority, r.created, r.open, pct(r.replyMetPercent), pct(r.resolveMetPercent)])}
              empty="No tickets."
            />
          </Section>

          <Section
            title="Channels"
            onExport={exportTable(
              "channels",
              ["Channel", "Created", "Resolved", "Avg first reply (min)", "SLA met %"],
              report.byChannel.map((c) => [c.channel, c.created, c.resolved, csvMinutes(c.avgFirstResponseMinutes), c.slaMetPercent])
            )}
          >
            <Table
              header={["Channel", "Created", "Resolved", "Avg first reply", "SLA met"]}
              rows={report.byChannel.map((c) => [c.channel, c.created, c.resolved, duration(c.avgFirstResponseMinutes), pct(c.slaMetPercent)])}
              empty="No tickets were created in this period."
            />
          </Section>
        </div>

        <Section
          title="Contact reasons"
          description="What customers got in touch about, by ticket category. Fixing the top few at the source cuts volume."
          onExport={exportTable(
            "contact-reasons",
            ["Category", "Tickets", "Share %", "Avg resolution (min)"],
            report.byCategory.map((c) => [c.category, c.created, c.share, csvMinutes(c.avgResolutionMinutes)])
          )}
        >
          <Table
            header={["Category", "Tickets", "Share", "Avg resolution"]}
            rows={report.byCategory.slice(0, 12).map((c) => [
              c.category,
              c.created,
              <span key="share" className="inline-flex items-center justify-end gap-3">
                <Meter value={c.share} />
                <span className="w-9">{c.share}%</span>
              </span>,
              duration(c.avgResolutionMinutes),
            ])}
            empty="No tickets were created in this period."
          />
        </Section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Section
            title="Quality"
            description={
              report.quality?.reviews
                ? `${report.quality.reviews} reviews, average ${report.quality.average}%`
                : "Finished QC reviews in this period"
            }
            onExport={
              report.quality
                ? exportTable("quality", ["Criterion", "Average %"], report.quality.byCriterion.map((c) => [c.label, c.average]))
                : undefined
            }
          >
            {report.quality === null ? (
              <p className="text-sm text-zinc-500">Quality checks aren&apos;t set up in this workspace.</p>
            ) : (
              <Table
                header={["Criterion", "Average"]}
                rows={report.quality.byCriterion.map((c) => [
                  c.label,
                  <span key="avg" className="inline-flex items-center justify-end gap-3">
                    <Meter value={c.average} />
                    <span className="w-9">{c.average}%</span>
                  </span>,
                ])}
                empty="No reviews were finished in this period."
              />
            )}
          </Section>

          <Section
            title="Support bot"
            description={
              report.bot?.chats
                ? `${report.bot.chats} chats · ${pct(report.bot.deflectionPercent)} solved without an agent`
                : "Chats with the AI assistant"
            }
            onExport={
              report.bot
                ? exportTable(
                    "bot",
                    ["Measure", "Value"],
                    [
                      ["Chats", report.bot.chats],
                      ["Solved by the bot", report.bot.resolvedByBot],
                      ["Handed to an agent", report.bot.handedOff],
                      ["Deflection %", report.bot.deflectionPercent],
                      ...report.bot.reasons.map((r): Cell[] => [`Handover: ${r.reason}`, r.count]),
                    ]
                  )
                : undefined
            }
          >
            {report.bot === null ? (
              <p className="text-sm text-zinc-500">The support bot isn&apos;t set up in this workspace.</p>
            ) : (
              <Table
                header={["Why it went to an agent", "Chats"]}
                rows={report.bot.reasons.map((r) => [r.reason, r.count])}
                empty={report.bot.chats ? "The bot handled every chat itself." : "No chats in this period."}
              />
            )}
          </Section>

          <Section title="Training" description="Courses passed in this period, and where things stand now">
            {report.training === null ? (
              <p className="text-sm text-zinc-500">Training isn&apos;t set up in this workspace.</p>
            ) : (
              <Table
                header={["Measure", "Value"]}
                rows={[
                  ["Passed in this period", report.training.passed],
                  ["Still to pass", report.training.open],
                  [
                    "Overdue",
                    report.training.overdue ? <span className="text-rose-600">{report.training.overdue}</span> : 0,
                  ],
                  ["Average best score", pct(report.training.averageBestScore)],
                ]}
                empty=""
              />
            )}
          </Section>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={exportTable(
              "summary",
              ["Period", "Created", "Resolved", "Avg first reply (min)", "Median first reply (min)", "Avg resolution (min)", "Median resolution (min)", "SLA met %", "Ticket CSAT", "Chat CSAT"],
              [summaryRows(`${period.fromDate} to ${period.toDate}`, s), summaryRows("Previous period", p)]
            )}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Download summary CSV
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
