"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_CRITERIA, MAX_CRITERIA, type Criterion } from "@/app/lib/quality/types";
import { buttonPrimary, buttonSecondary, inputBase } from "@/app/components/ui/Panel";
import { saveScorecardAction } from "../actions";

type Row = Partial<Criterion> & { key: number };

const inputClass = `w-full ${inputBase}`;

let nextKey = 0;
const toRows = (criteria: Criterion[]): Row[] => criteria.map((c) => ({ ...c, key: nextKey++ }));

export default function ScorecardEditor({ initial }: { initial: Criterion[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const weightSum = rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);

  function update(key: number, changes: Partial<Criterion>) {
    setSaved(false);
    setRows((current) => current.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveScorecardAction(rows.map(({ id, label, description, weight }) => ({ id, label, description, weight })));
      if (!result.ok) setError(result.error ?? "Could not save.");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.key} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex gap-3">
            <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">{index + 1}</span>
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <input
                  value={row.label ?? ""}
                  onChange={(e) => update(row.key, { label: e.target.value })}
                  placeholder="Criterion, e.g. Correct resolution"
                  aria-label="Criterion name"
                  maxLength={80}
                  className={inputClass}
                />
                <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                  Weight
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={row.weight ?? ""}
                    onChange={(e) => update(row.key, { weight: Number(e.target.value) })}
                    className={`${inputClass} w-20`}
                  />
                </label>
              </div>
              <textarea
                value={row.description ?? ""}
                onChange={(e) => update(row.key, { description: e.target.value })}
                placeholder="What should the reviewer look for?"
                aria-label="What to look for"
                rows={2}
                maxLength={400}
                className={inputClass}
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              aria-label={`Remove ${row.label || "criterion"}`}
              className="self-start rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-rose-600"
            >
              ✕
            </button>
          </div>
          {weightSum > 0 && (
            <p className="mt-2 pl-9 text-xs text-zinc-500">
              Counts for {Math.round(((Number(row.weight) || 0) / weightSum) * 100)}% of the score
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={rows.length >= MAX_CRITERIA}
            onClick={() => setRows((current) => [...current, { key: nextKey++, label: "", description: "", weight: 10 }])}
            className={buttonSecondary}
          >
            + Add criterion
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setRows(toRows(DEFAULT_CRITERIA));
            }}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            Reset to default
          </button>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className={buttonPrimary}
        >
          {isPending ? "Saving…" : "Save scorecard"}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">Scorecard saved. New reviews will use it.</p>}
    </div>
  );
}
