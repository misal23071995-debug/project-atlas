"use client";

import { useState } from "react";

// Tickets received per hour of the day, with the day before as pale bars behind for comparison
export default function HourlyChart({
  today,
  yesterday,
  currentHour,
  todayLabel,
  yesterdayLabel,
}: {
  today: number[];
  yesterday: number[];
  // Hours after this haven't happened yet (today only)
  currentHour: number | null;
  todayLabel: string;
  yesterdayLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 200;
  const pad = { top: 10, right: 6, bottom: 22, left: 30 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const peak = Math.max(1, ...today, ...yesterday);
  const step = peak <= 5 ? 1 : peak <= 10 ? 2 : peak <= 25 ? 5 : peak <= 50 ? 10 : Math.ceil(peak / 50) * 10;
  const max = Math.ceil(peak / step) * step;
  const slot = plotW / 24;
  const bar = Math.min(18, slot - 6);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);

  // 4px rounded tops, square at the baseline
  const column = (x: number, w: number, value: number) => {
    const top = y(value);
    const h = pad.top + plotH - top;
    if (h <= 0) return "";
    const r = Math.min(3, h, w / 2);
    return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`;
  };
  const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> {todayLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> {yesterdayLabel}
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Tickets per hour, ${todayLabel} compared with ${yesterdayLabel}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
              <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">
                {t}
              </text>
            </g>
          ))}
          {today.map((v, h) => {
            const x = pad.left + h * slot + (slot - bar) / 2;
            const future = currentHour !== null && h > currentHour;
            return (
              <g key={h}>
                {hover === h && <rect x={pad.left + h * slot} y={pad.top} width={slot} height={plotH} fill="#eef2ff" />}
                <path d={column(x, bar, yesterday[h])} fill="#cbd5e1" />
                {!future && <path d={column(x + bar * 0.25, bar * 0.5, v)} fill="#4f46e5" />}
                {h % 3 === 0 && (
                  <text x={pad.left + h * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#64748b">
                    {String(h).padStart(2, "0")}
                  </text>
                )}
                <rect
                  x={pad.left + h * slot}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(h)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%` }}
          >
            <p className="font-medium text-zinc-900">
              {hourLabel(hover)}–{hourLabel((hover + 1) % 24)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-zinc-700">
              <i className="h-2 w-2 rounded-sm bg-indigo-600" /> {todayLabel}:{" "}
              {currentHour !== null && hover > currentHour ? "not yet" : today[hover]}
            </p>
            <p className="flex items-center gap-1.5 text-zinc-700">
              <i className="h-2 w-2 rounded-sm bg-zinc-300" /> {yesterdayLabel}: {yesterday[hover]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
