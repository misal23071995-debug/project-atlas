"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/app/lib/auth/roles";
import type { Member } from "@/app/lib/auth/session";
import {
  addMemberAction,
  changePasswordAction,
  changeRoleAction,
  removeMemberAction,
  renameWorkspaceAction,
  updateProfileAction,
  type FormState,
} from "./actions";

export const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const labelClass = "block text-sm text-zinc-600";
const buttonClass =
  "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60";

// A form wired to a Server Action that returns { error } or { success }
function ActionForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} key={resetOnSuccess && state.success ? state.success : undefined} className="space-y-4">
      {children}
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-emerald-600">{state.success}</p>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export function ProfileForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateProfileAction} submitLabel="Save name">
      <label className={labelClass}>
        Display name
        <input name="name" defaultValue={name} required maxLength={100} className={inputClass} />
        <span className="mt-1 block text-xs text-zinc-500">Shown on replies, notes and the Assigned To list</span>
      </label>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} submitLabel="Change password" resetOnSuccess>
      <label className={labelClass}>
        New password
        <input type="password" name="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
      <label className={labelClass}>
        Repeat new password
        <input type="password" name="confirm" required minLength={8} autoComplete="new-password" className={inputClass} />
      </label>
    </ActionForm>
  );
}

export function WorkspaceForm({ name }: { name: string }) {
  return (
    <ActionForm action={renameWorkspaceAction} submitLabel="Save company name">
      <label className={labelClass}>
        Company name
        <input name="name" defaultValue={name} required maxLength={80} className={inputClass} />
        <span className="mt-1 block text-xs text-zinc-500">Customers see this on your chat page</span>
      </label>
    </ActionForm>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex gap-2">
      <input readOnly value={url} aria-label="Customer chat link" className={`${inputClass} mt-0`} />
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function AddMemberForm() {
  const [method, setMethod] = useState<"invite" | "password">("invite");
  return (
    <ActionForm action={addMemberAction} submitLabel={method === "invite" ? "Send invite" : "Add member"} resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input name="name" maxLength={100} className={inputClass} />
        </label>
        <label className={labelClass}>
          Email
          <input type="email" name="email" required className={inputClass} />
        </label>
        <label className={labelClass}>
          Role
          <select name="role" defaultValue="agent" className={inputClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm text-zinc-600">
          <legend>How they get in</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-zinc-800">
              <input type="radio" name="method" value="invite" checked={method === "invite"} onChange={() => setMethod("invite")} />
              Email them an invite link
            </label>
            <label className="flex items-center gap-2 text-zinc-800">
              <input type="radio" name="method" value="password" checked={method === "password"} onChange={() => setMethod("password")} />
              Set a temporary password
            </label>
          </div>
        </fieldset>
        {method === "password" && (
          <label className={labelClass}>
            Temporary password
            <input type="text" name="password" minLength={8} autoComplete="off" className={inputClass} />
          </label>
        )}
      </div>
      <p className="text-xs text-zinc-500">
        {method === "invite"
          ? "They get an email with a link to choose their own password. You never see it."
          : "Share the password with them privately; they can change it in Settings."}{" "}
        If they already have an Atlas login, they&apos;re simply added.
      </p>
    </ActionForm>
  );
}

export function MemberRow({ member, isYou, canManage }: { member: Member; isYou: boolean; canManage: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <tr className="border-t border-zinc-200 align-top">
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-900">
          {member.name}
          {isYou && <span className="ml-2 text-xs text-zinc-500">(you)</span>}
        </p>
        <p className="text-xs text-zinc-500">{member.email}</p>
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-4 py-3">
        {canManage ? (
          <select
            value={member.role}
            disabled={isPending}
            onChange={(e) => run(() => changeRoleAction(member.id, e.target.value))}
            aria-label={`Role for ${member.name}`}
            className="rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-sm disabled:opacity-60"
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-zinc-700">{ROLE_LABELS[member.role as Role]}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {canManage && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              const who = isYou ? "yourself" : member.name;
              if (confirm(`Remove ${who} from this workspace? Their login stays, but they lose access here.`)) {
                run(() => removeMemberAction(member.id));
              }
            }}
            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

export function RoleGuide() {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {ROLES.map((role) => (
        <div key={role} className="rounded-lg border border-zinc-200 bg-white p-3">
          <dt className="text-sm font-medium text-zinc-900">{ROLE_LABELS[role]}</dt>
          <dd className="mt-1 text-xs text-zinc-600">{ROLE_DESCRIPTIONS[role]}</dd>
        </div>
      ))}
    </dl>
  );
}
