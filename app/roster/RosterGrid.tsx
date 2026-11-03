"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, type Role } from "@/app/lib/auth/roles";
import {
  addDays,
  formatDay,
  formatHours,
  formatMinutes,
  LEAVE_LABELS,
  leaveCovers,
  paidMinutes,
  parseTime,
  shiftLabel,
  SHIFT_TEMPLATES,
  weekDates,
  type LeaveRequest,
  type Shift,
  type ShiftBreak,
} from "@/app/lib/roster/types";
import { copyPreviousWeekAction, deleteShiftAction, saveShiftAction } from "./actions";

type Member = { id: string; name: string; role: Role };
type Cell = { member: Member; date: string; shift: Shift | null };

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500";

export default function RosterGrid({
  monday,
  today,
  members,
  shifts,
  leave,
  currentUserId,
  canManage,
}: {
  monday: string;
  today: string;
  members: Member[];
  shifts: Shift[];
  leave: LeaveRequest[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Cell | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const days = weekDates(monday);
  const shiftAt = new Map(shifts.map((s) => [`${s.userId}:${s.date}`, s]));
  const leaveOn = (userId: string, date: string) =>
    leave.find((l) => l.userId === userId && leaveCovers(l, date)) ?? null;

  // Signed-in person first, then everyone else by name
  const rows = [...members].sort((a, b) =>
    a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.name.localeCompare(b.name)
  );

  function copyLastWeek() {
    setNotice(null);
    startTransition(async () => {
      const result = await copyPreviousWeekAction(monday);
      setNotice(
        !result.ok
          ? result.error ?? "Could not copy."
          : result.added
          ? `Copied ${result.added} shift${result.added === 1 ? "" : "s"} from last week.`
          : "Nothing to copy: last week was empty, or these days already have shifts."
      );
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Roster</h1>
          <p className="mt-1 text-zinc-400">
            Week of {formatDay(monday)} – {formatDay(addDays(monday, 6))}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/roster?week=${addDays(monday, -7)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
            ← Previous
          </Link>
          <Link href="/roster" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
            This week
          </Link>
          <Link href={`/roster?week=${addDays(monday, 7)}`} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
            Next →
          </Link>
          {canManage && (
            <button
              type="button"
              onClick={copyLastWeek}
              disabled={isPending}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-60"
            >
              {isPending ? "Copying…" : "Copy last week"}
            </button>
          )}
          <Link href="/roster/leave" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            Leave
          </Link>
        </div>
      </div>

      {notice && <p className="mt-4 text-sm text-zinc-300">{notice}</p>}
      {canManage && <p className="mt-4 text-xs text-zinc-500">Click any day to add or change a shift.</p>}

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="min-w-[900px] w-full table-fixed text-sm">
          <thead className="bg-zinc-900 text-left text-zinc-400">
            <tr>
              <th className="w-48 px-3 py-3 font-medium">Person</th>
              {days.map((date) => (
                <th key={date} className={`px-2 py-3 font-medium ${date === today ? "text-indigo-300" : ""}`}>
                  {formatDay(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => {
              const weekMinutes = days.reduce((sum, date) => {
                const shift = shiftAt.get(`${member.id}:${date}`);
                return sum + (shift ? paidMinutes(shift) : 0);
              }, 0);

              return (
                <tr key={member.id} className={`border-t border-zinc-800 ${member.id === currentUserId ? "bg-indigo-500/5" : ""}`}>
                  <td className="px-3 py-2 align-top">
                    <p className="truncate font-medium text-zinc-100">
                      {member.name}
                      {member.id === currentUserId && <span className="ml-1 text-xs text-zinc-500">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {ROLE_LABELS[member.role]} · {formatHours(weekMinutes)}
                    </p>
                  </td>

                  {days.map((date) => {
                    const shift = shiftAt.get(`${member.id}:${date}`) ?? null;
                    const away = leaveOn(member.id, date);
                    const clash = shift && away?.status === "approved";

                    const content = (
                      <>
                        {shift && (
                          <div className={`rounded-md px-2 py-1 ${clash ? "bg-red-500/15 ring-1 ring-red-500/50" : "bg-indigo-500/15"}`}>
                            <p className="font-medium text-indigo-200">{shiftLabel(shift)}</p>
                            <p className="text-[11px] text-zinc-400">
                              {formatHours(paidMinutes(shift))}
                              {shift.breaks.length > 0 &&
                                ` · break ${shift.breaks.map((b) => formatMinutes(b.start)).join(", ")}`}
                            </p>
                            {shift.note && <p className="truncate text-[11px] text-zinc-500">{shift.note}</p>}
                          </div>
                        )}
                        {away && (
                          <div
                            className={`mt-1 rounded-md px-2 py-1 text-[11px] ${
                              away.status === "approved"
                                ? "bg-amber-500/15 text-amber-300"
                                : "border border-dashed border-amber-500/40 text-amber-400/80"
                            }`}
                          >
                            {LEAVE_LABELS[away.type]}
                            {away.status === "requested" && " (requested)"}
                          </div>
                        )}
                        {clash && <p className="mt-1 text-[11px] text-red-400">On leave: remove shift?</p>}
                      </>
                    );

                    return (
                      <td key={date} className={`h-20 px-1.5 py-1.5 align-top ${date === today ? "bg-indigo-500/5" : ""}`}>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => setEditing({ member, date, shift })}
                            aria-label={`${shift ? "Edit" : "Add"} shift for ${member.name} on ${formatDay(date)}`}
                            className="h-full w-full rounded-md p-0.5 text-left hover:bg-zinc-800/70"
                          >
                            {content}
                            {!shift && !away && <span className="text-xs text-zinc-700">+</span>}
                          </button>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-zinc-700 bg-zinc-900 text-xs text-zinc-400">
            <tr>
              <td className="px-3 py-2 font-medium">On shift</td>
              {days.map((date) => {
                const onShift = shifts.filter((s) => s.date === date);
                const minutes = onShift.reduce((sum, s) => sum + paidMinutes(s), 0);
                return (
                  <td key={date} className="px-2 py-2">
                    <span className="font-semibold text-zinc-200">{onShift.length}</span> people · {formatHours(minutes)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {editing && (
        <ShiftEditor
          key={`${editing.member.id}:${editing.date}`}
          cell={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ShiftEditor({ cell, onClose, onSaved }: { cell: Cell; onClose: () => void; onSaved: () => void }) {
  // A new shift starts as the Day template
  const day = SHIFT_TEMPLATES[1];
  const initial = cell.shift ?? { startMinute: day.start, endMinute: day.end, breaks: day.breaks, note: "" };
  const [start, setStart] = useState(formatMinutes(initial.startMinute));
  const [end, setEnd] = useState(formatMinutes(initial.endMinute));
  const [breaks, setBreaks] = useState<{ start: string; minutes: number }[]>(
    initial.breaks.map((b) => ({ start: formatMinutes(b.start), minutes: b.minutes }))
  );
  const [note, setNote] = useState(initial.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyTemplate(template: (typeof SHIFT_TEMPLATES)[number]) {
    setStart(formatMinutes(template.start));
    setEnd(formatMinutes(template.end));
    setBreaks(template.breaks.map((b) => ({ start: formatMinutes(b.start), minutes: b.minutes })));
  }

  function save() {
    const startMinute = parseTime(start);
    const endMinute = parseTime(end);
    const parsedBreaks = breaks.map((b) => ({ start: parseTime(b.start), minutes: b.minutes }));
    if (startMinute === null || endMinute === null || parsedBreaks.some((b) => b.start === null)) {
      setError("Enter times like 09:00.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveShiftAction({
        userId: cell.member.id,
        date: cell.date,
        startMinute,
        endMinute,
        breaks: parsedBreaks as ShiftBreak[],
        note,
      });
      if (result.ok) onSaved();
      else setError(result.error ?? "Could not save.");
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteShiftAction(cell.member.id, cell.date);
      if (result.ok) onSaved();
      else setError(result.error ?? "Could not remove.");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Shift for ${cell.member.name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div>
          <h2 className="text-lg font-semibold">{cell.member.name}</h2>
          <p className="text-sm text-zinc-400">{formatDay(cell.date)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SHIFT_TEMPLATES.map((template) => (
            <button
              key={template.name}
              type="button"
              onClick={() => applyTemplate(template)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-indigo-500 hover:text-white"
            >
              {template.name} {formatMinutes(template.start)}–{formatMinutes(template.end)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-zinc-400">
            Start
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
          <label className="text-sm text-zinc-400">
            End
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1 ${inputClass}`} />
          </label>
        </div>
        {parseTime(end) !== null && parseTime(start) !== null && parseTime(end)! <= parseTime(start)! && (
          <p className="-mt-2 text-xs text-zinc-500">Ends the next morning (overnight shift).</p>
        )}

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Breaks</p>
          {breaks.map((b, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="time"
                value={b.start}
                aria-label="Break start"
                onChange={(e) => setBreaks((current) => current.map((x, i) => (i === index ? { ...x, start: e.target.value } : x)))}
                className={inputClass}
              />
              <select
                value={b.minutes}
                aria-label="Break length"
                onChange={(e) =>
                  setBreaks((current) => current.map((x, i) => (i === index ? { ...x, minutes: Number(e.target.value) } : x)))
                }
                className={inputClass}
              >
                {[10, 15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Remove break"
                onClick={() => setBreaks((current) => current.filter((_, i) => i !== index))}
                className="px-2 text-zinc-500 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          ))}
          {breaks.length < 6 && (
            <button
              type="button"
              onClick={() => setBreaks((current) => [...current, { start: start || "12:00", minutes: 15 }])}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Add break
            </button>
          )}
        </div>

        <label className="block text-sm text-zinc-400">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. Email queue, training at 3pm" className={`mt-1 ${inputClass}`} />
        </label>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {cell.shift ? (
            <button type="button" onClick={remove} disabled={isPending} className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50">
              Remove shift
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {isPending ? "Saving…" : "Save shift"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
