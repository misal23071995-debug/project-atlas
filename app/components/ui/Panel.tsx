import Link from "next/link";
import type { ReactNode } from "react";

// Shared building blocks so every screen has the same header, panels and tables

export const buttonPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";
export const buttonSecondary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";
export const inputBase =
  "rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15";

// Table cells for tables that sit flush inside a Panel
export const th = "whitespace-nowrap px-5 py-2.5 text-left text-xs font-medium text-zinc-500";
export const td = "px-5 py-2.5";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
          ← {back.label}
        </Link>
      )}
      <div className={`flex flex-wrap items-end justify-between gap-3 ${back ? "mt-1.5" : ""}`}>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {description && <p className="mt-0.5 max-w-3xl text-sm text-zinc-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  className = "",
  flush = false,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  // No padding, for tables and lists that run edge to edge
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    // min-w-0 lets wide tables scroll inside the panel instead of stretching the page
    <section className={`min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

// A row of numbers in one card, split by thin lines
export function StatStrip({ stats, className = "" }: { stats: { label: string; value: ReactNode; hint?: ReactNode }[]; className?: string }) {
  const cols = stats.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    // The 1px gap over a grey background draws the lines between cells at any width
    <div className={`grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm ${cols} ${className}`}>
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 bg-white px-5 py-4">
          <p className="text-xs font-medium text-zinc-500">{s.label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-900">{s.value}</p>
          {s.hint && <p className="mt-0.5 text-xs text-zinc-500">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-zinc-500">{children}</p>;
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "rose" | "emerald" | "indigo"; children: ReactNode }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
