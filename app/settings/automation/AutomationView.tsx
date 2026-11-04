"use client";

import { useActionState, useState, useTransition } from "react";
import { useNow } from "@/app/components/useNow";
import {
  ACTIONS,
  ASSIGNMENT_LABELS,
  ASSIGNMENT_MODES,
  AUTO_ASSIGN,
  FIELDS,
  MAX_ACTIONS,
  MAX_CONDITIONS,
  OPERATORS,
  TIMED_TRIGGERS,
  TRIGGERS,
  TRIGGER_LABELS,
  describeAction,
  operatorsFor,
  type Action,
  type ActionType,
  type AssignmentSettings,
  type Condition,
  type Field,
  type Rule,
  type Trigger,
} from "@/app/lib/automation/types";
import {
  addStarterRulesAction,
  deleteRuleAction,
  moveRuleAction,
  runTimedRulesNowAction,
  saveAssignmentAction,
  saveRuleAction,
  setRuleEnabledAction,
  type ActionResult,
} from "./actions";

type Person = { id: string; name: string; role: string };

const control =
  "h-9 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-indigo-500 disabled:opacity-60";
const card = "rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6";
const primary = "inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60";
const quiet = "inline-flex h-9 items-center rounded-lg border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60";

function Message({ result }: { result: ActionResult }) {
  if (result.error) return <p role="alert" className="text-sm text-red-400">{result.error}</p>;
  if (result.success) return <p role="status" className="text-sm text-emerald-400">{result.success}</p>;
  return null;
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} hr ago`;
  return `${Math.floor(minutes / (24 * 60))} d ago`;
}

function waitLabel(hours: number) {
  return hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? "" : "s"}` : `${hours} hour${hours === 1 ? "" : "s"}`;
}

// "When a ticket is created · if Channel is Email · then set priority to High"
function Summary({ rule }: { rule: Rule }) {
  return (
    <p className="text-sm leading-relaxed text-zinc-400">
      <span className="font-medium text-zinc-300">When</span> {TRIGGER_LABELS[rule.trigger].toLowerCase()}
      {rule.trigger === "waiting_on_customer" && rule.waitHours ? ` ${waitLabel(rule.waitHours)}` : ""}
      {rule.conditions.length > 0 && (
        <>
          {" "}
          <span className="font-medium text-zinc-300">and</span>{" "}
          {rule.conditions.map((c, i) => (
            <span key={i}>
              {i > 0 && " and "}
              {FIELDS[c.field].label.toLowerCase()} {OPERATORS[c.op]} <span className="text-zinc-200">“{c.value}”</span>
            </span>
          ))}
        </>
      )}
      , <span className="font-medium text-zinc-300">then</span> {rule.actions.map(describeAction).join(", ")}.
    </p>
  );
}

// ---- Assignment ----

function AssignmentCard({ settings, people }: { settings: AssignmentSettings; people: Person[] }) {
  const [state, formAction, pending] = useActionState(saveAssignmentAction, {});
  const [mode, setMode] = useState(settings.mode);
  const everyone = settings.userIds.length === 0;

  return (
    <form action={formAction} className={`${card} space-y-5`}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-50">Assignment</h2>
        <p className="mt-1 text-sm text-zinc-400">How new tickets get an owner. Rules run first, so a rule can still assign a ticket to someone specific.</p>
      </div>

      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="sr-only">Assignment method</legend>
        {ASSIGNMENT_MODES.map((m) => (
          <label
            key={m}
            className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm ${
              mode === m ? "border-indigo-500 bg-indigo-500/10 text-zinc-100" : "border-zinc-800 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-0.5" />
            {ASSIGNMENT_LABELS[m]}
          </label>
        ))}
      </fieldset>

      {mode !== "off" && (
        <>
          <label className="flex items-start gap-2.5 text-sm text-zinc-300">
            <input type="checkbox" name="onlyOnShift" defaultChecked={settings.onlyOnShift} className="mt-0.5" />
            <span>
              Only people on shift right now, from the roster. If nobody is on shift, the ticket waits unassigned.
            </span>
          </label>

          <div>
            <p className="text-sm text-zinc-400">Who can receive tickets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {people.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-200">
                  <input type="checkbox" name="userIds" value={p.id} defaultChecked={everyone || settings.userIds.includes(p.id)} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      {mode === "off" &&
        // Keep everyone ticked in the background, so switching on later starts with the whole team
        people.map((p) => <input key={p.id} type="hidden" name="userIds" value={p.id} />)}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Saving…" : "Save assignment"}
        </button>
        <Message result={state} />
      </div>
    </form>
  );
}

// ---- Rule editor ----

type Draft = Pick<Rule, "name" | "enabled" | "trigger" | "waitHours" | "conditions" | "actions">;

const BLANK: Draft = {
  name: "",
  enabled: true,
  trigger: "ticket_created",
  waitHours: null,
  conditions: [],
  actions: [{ type: "set_priority", value: "High" }],
};

function ValueInput({
  options,
  value,
  onChange,
  label,
  wide,
}: {
  options: readonly string[] | null;
  value: string;
  onChange: (v: string) => void;
  label: string;
  wide?: boolean;
}) {
  if (options) {
    return (
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${control} min-w-0 flex-1`}>
        {!options.includes(value) && <option value="">Choose…</option>}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  return wide ? (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={`${control} h-auto min-w-0 flex-1 py-2`} />
  ) : (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${control} min-w-0 flex-1`} />
  );
}

function RuleEditor({
  rule,
  people,
  onClose,
}: {
  rule: Rule | null;
  people: Person[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(rule ? { ...rule } : BLANK);
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();
  const set = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }));

  const agentOptions = [AUTO_ASSIGN, ...people.filter((p) => p.role !== "qa").map((p) => p.name)];
  const waitDays = draft.waitHours && draft.waitHours % 24 === 0;

  function updateCondition(i: number, changes: Partial<Condition>) {
    const conditions = draft.conditions.map((c, j) => {
      if (j !== i) return c;
      const next = { ...c, ...changes };
      // A new field may not support the old operator or value
      if (changes.field) {
        next.op = operatorsFor(changes.field)[0];
        next.value = FIELDS[changes.field].options?.[0] ?? "";
      }
      return next;
    });
    set({ conditions });
  }

  function updateAction(i: number, changes: Partial<Action>) {
    const actions = draft.actions.map((a, j) => {
      if (j !== i) return a;
      const next = { ...a, ...changes };
      if (changes.type) next.value = changes.type === "assign" ? AUTO_ASSIGN : ACTIONS[changes.type].options?.[0] ?? "";
      return next;
    });
    set({ actions });
  }

  function save() {
    setResult({});
    startTransition(async () => {
      const res = await saveRuleAction(rule?.id ?? null, draft);
      setResult(res);
      if (res.success) onClose();
    });
  }

  return (
    <div className={`${card} space-y-5 border-indigo-500/40`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-zinc-50">{rule ? "Edit rule" : "New rule"}</h3>
        <button type="button" onClick={onClose} className="text-sm text-zinc-400 hover:text-zinc-200">
          Cancel
        </button>
      </div>

      <label className="block text-sm text-zinc-400">
        Name
        <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="e.g. Refunds go to billing" className={`${control} mt-1 w-full`} />
      </label>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">When</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="When the rule runs"
            value={draft.trigger}
            onChange={(e) => {
              const trigger = e.target.value as Trigger;
              set({ trigger, waitHours: trigger === "waiting_on_customer" ? draft.waitHours ?? 72 : null });
            }}
            className={control}
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
          {draft.trigger === "waiting_on_customer" && (
            <>
              <input
                type="number"
                aria-label="How long"
                min={1}
                value={draft.waitHours ? (waitDays ? draft.waitHours / 24 : draft.waitHours) : ""}
                onChange={(e) => set({ waitHours: Math.max(1, Number(e.target.value) || 1) * (waitDays ? 24 : 1) })}
                className={`${control} w-20`}
              />
              <select
                aria-label="Unit"
                value={waitDays ? "days" : "hours"}
                onChange={(e) => {
                  const amount = draft.waitHours ? (waitDays ? draft.waitHours / 24 : draft.waitHours) : 3;
                  set({ waitHours: e.target.value === "days" ? amount * 24 : amount });
                }}
                className={control}
              >
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </>
          )}
        </div>
        {TIMED_TRIGGERS.includes(draft.trigger) && (
          <p className="text-xs text-zinc-500">Checked in the background every few minutes. Each ticket is acted on once by this rule.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">If all of these match</p>
        {draft.conditions.length === 0 && <p className="text-sm text-zinc-500">No conditions: the rule applies to every ticket.</p>}
        {draft.conditions.map((c, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Field" value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value as Field })} className={control}>
              {(Object.keys(FIELDS) as Field[]).map((f) => (
                <option key={f} value={f}>
                  {FIELDS[f].label}
                </option>
              ))}
            </select>
            <select aria-label="Comparison" value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value as Condition["op"] })} className={control}>
              {operatorsFor(c.field).map((op) => (
                <option key={op} value={op}>
                  {OPERATORS[op]}
                </option>
              ))}
            </select>
            <ValueInput
              label="Value"
              options={c.field === "assigned_to" ? ["Unassigned", ...agentOptions.slice(1)] : FIELDS[c.field].options}
              value={c.value}
              onChange={(value) => updateCondition(i, { value })}
            />
            <button type="button" aria-label="Remove condition" onClick={() => set({ conditions: draft.conditions.filter((_, j) => j !== i) })} className="h-9 px-2 text-zinc-500 hover:text-red-400">
              ✕
            </button>
          </div>
        ))}
        {draft.conditions.length < MAX_CONDITIONS && (
          <button
            type="button"
            onClick={() => set({ conditions: [...draft.conditions, { field: "category", op: "is", value: FIELDS.category.options[0] }] })}
            className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            + Add condition
          </button>
        )}
        {draft.conditions.some((c) => c.op === "contains" || c.op === "not_contains") && (
          <p className="text-xs text-zinc-500">For “contains”, separate words with commas: any of them counts.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Then</p>
        {draft.actions.map((a, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row">
            <select aria-label="Action" value={a.type} onChange={(e) => updateAction(i, { type: e.target.value as ActionType })} className={control}>
              {(Object.keys(ACTIONS) as ActionType[]).map((t) => (
                <option key={t} value={t}>
                  {ACTIONS[t].label}
                </option>
              ))}
            </select>
            {a.type === "assign" ? (
              <select aria-label="Assign to" value={a.value} onChange={(e) => updateAction(i, { value: e.target.value })} className={`${control} min-w-0 flex-1`}>
                {agentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name === AUTO_ASSIGN ? "Whoever the assignment method picks" : name}
                  </option>
                ))}
              </select>
            ) : (
              <ValueInput label="Value" options={ACTIONS[a.type].options} value={a.value} onChange={(value) => updateAction(i, { value })} wide={a.type === "add_note"} />
            )}
            <button type="button" aria-label="Remove action" onClick={() => set({ actions: draft.actions.filter((_, j) => j !== i) })} className="h-9 px-2 text-zinc-500 hover:text-red-400">
              ✕
            </button>
          </div>
        ))}
        {draft.actions.length < MAX_ACTIONS && (
          <button
            type="button"
            onClick={() => set({ actions: [...draft.actions, { type: "add_tag", value: "" }] })}
            className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            + Add action
          </button>
        )}
      </div>

      <label className="flex items-center gap-2.5 text-sm text-zinc-300">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Turned on
      </label>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className={primary}>
          {pending ? "Saving…" : rule ? "Save rule" : "Add rule"}
        </button>
        <Message result={result} />
      </div>
    </div>
  );
}

// ---- Rule list ----

function RuleCard({ rule, first, last, canEdit, onEdit }: { rule: Rule; first: boolean; last: boolean; canEdit: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const run = (action: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <li className={`${card} flex flex-col gap-3 ${rule.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-50">{rule.name}</h3>
            {!rule.enabled && <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-inset ring-zinc-500/25">Off</span>}
          </div>
          <div className="mt-1">
            <Summary rule={rule} />
          </div>
          <p className="mt-2 text-xs text-zinc-500 tabular">
            {rule.runCount ? `Ran ${rule.runCount.toLocaleString("en-IN")} time${rule.runCount === 1 ? "" : "s"}` : "Hasn't run yet"}
            {rule.lastRunAt && now !== null && ` · last ${timeAgo(rule.lastRunAt, now)}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Run earlier" disabled={first || pending} onClick={() => run(() => moveRuleAction(rule.id, "up"))} className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
              ↑
            </button>
            <button type="button" aria-label="Run later" disabled={last || pending} onClick={() => run(() => moveRuleAction(rule.id, "down"))} className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
              ↓
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => setRuleEnabledAction(rule.id, !rule.enabled))} className="h-8 rounded-lg px-2.5 text-sm text-zinc-300 hover:bg-zinc-800">
              {rule.enabled ? "Turn off" : "Turn on"}
            </button>
            <button type="button" onClick={onEdit} className="h-8 rounded-lg px-2.5 text-sm text-indigo-300 hover:bg-zinc-800">
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Delete “${rule.name}”?`)) run(() => deleteRuleAction(rule.id));
              }}
              className="h-8 rounded-lg px-2.5 text-sm text-red-400 hover:bg-zinc-800"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </li>
  );
}

export default function AutomationView({
  rules,
  assignment,
  people,
  canEdit,
}: {
  rules: Rule[];
  assignment: AssignmentSettings;
  people: Person[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [adding, startAdding] = useTransition();
  const [sweep, setSweep] = useState<ActionResult>({});
  const [sweeping, startSweep] = useTransition();
  const hasTimed = rules.some((r) => r.enabled && TIMED_TRIGGERS.includes(r.trigger));

  return (
    <div className="space-y-8">
      {canEdit ? <AssignmentCard settings={assignment} people={people.filter((p) => p.role !== "qa")} /> : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-50">Rules</h2>
            <p className="mt-1 text-sm text-zinc-400">Rules run from top to bottom; a later rule sees what earlier ones changed. Every change shows in the ticket’s activity.</p>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              {hasTimed && (
                <button
                  type="button"
                  disabled={sweeping}
                  onClick={() => startSweep(async () => setSweep(await runTimedRulesNowAction()))}
                  className={quiet}
                >
                  {sweeping ? "Checking…" : "Check time-based rules now"}
                </button>
              )}
              <button type="button" onClick={() => setEditing("new")} className={primary}>
                New rule
              </button>
            </div>
          )}
        </div>
        <Message result={sweep} />

        {editing === "new" && <RuleEditor rule={null} people={people} onClose={() => setEditing(null)} />}

        {rules.length === 0 && editing !== "new" ? (
          <div className={`${card} text-sm text-zinc-400`}>
            <p>No rules yet. Start with five that most support teams use, then change them to suit yours.</p>
            {canEdit && (
              <button type="button" disabled={adding} onClick={() => startAdding(() => addStarterRulesAction())} className={`${quiet} mt-4`}>
                {adding ? "Adding…" : "Add 5 starter rules"}
              </button>
            )}
          </div>
        ) : (
          <ol className="space-y-3">
            {rules.map((rule, i) =>
              editing === rule.id ? (
                <li key={rule.id}>
                  <RuleEditor rule={rule} people={people} onClose={() => setEditing(null)} />
                </li>
              ) : (
                <RuleCard key={rule.id} rule={rule} first={i === 0} last={i === rules.length - 1} canEdit={canEdit} onEdit={() => setEditing(rule.id)} />
              )
            )}
          </ol>
        )}
      </section>
    </div>
  );
}
