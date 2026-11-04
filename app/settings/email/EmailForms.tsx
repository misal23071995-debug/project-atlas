"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { EmailSettings } from "@/app/lib/db/email";
import { regenerateInboundKeyAction, saveEmailSettingsAction, sendTestEmailAction } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const labelClass = "block text-sm text-zinc-400";
const buttonClass = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60";

function Status({ error, success, children }: { error?: string; success?: string; children?: ReactNode }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {success && (
        <p role="status" className="text-sm text-emerald-400">
          {success} {children}
        </p>
      )}
    </>
  );
}

export function InboundAddress({ url, canRegenerate }: { url: string; canRegenerate: boolean }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input readOnly value={url} aria-label="Incoming mail webhook address" className={`${inputClass} mt-0 font-mono text-xs`} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {canRegenerate && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Make a new address? The current one stops working straight away, so update your email provider too.")) {
              startTransition(() => regenerateInboundKeyAction());
            }
          }}
          className="text-sm text-red-400 hover:text-red-300"
        >
          {pending ? "Changing…" : "Make a new address"}
        </button>
      )}
    </div>
  );
}

export function EmailSettingsForm({ settings, workspaceName }: { settings: EmailSettings; workspaceName: string }) {
  const [state, formAction, pending] = useActionState(saveEmailSettingsAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className={labelClass}>
        Sender name
        <input name="fromName" defaultValue={settings.fromName ?? ""} placeholder={`${workspaceName} Support`} maxLength={80} className={inputClass} />
      </label>
      <label className={labelClass}>
        Signature, added under every email
        <textarea name="signature" defaultValue={settings.signature} rows={3} maxLength={1000} placeholder={`${workspaceName} Support`} className={inputClass} />
      </label>
      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input type="checkbox" name="autoAcknowledge" defaultChecked={settings.autoAcknowledge} className="mt-0.5 h-4 w-4" />
        <span>
          Reply to new emails straight away with the ticket number and when to expect an answer
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm text-zinc-300">
        <input type="checkbox" name="surveyOnResolve" defaultChecked={settings.surveyOnResolve} className="mt-0.5 h-4 w-4" />
        <span>Email the satisfaction survey when an email ticket is resolved</span>
      </label>
      <Status error={state.error} success={state.success} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function TestInbox() {
  const [state, formAction, pending] = useActionState(sendTestEmailAction, {});

  return (
    <form action={formAction} key={state.ticketId} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Customer name
          <input name="fromName" defaultValue="Aanya Rao" required maxLength={100} className={inputClass} />
        </label>
        <label className={labelClass}>
          Customer email
          <input name="fromEmail" type="email" defaultValue="aanya.rao@example.com" required className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        Subject
        <input name="subject" defaultValue="Ring stopped syncing after the update" required maxLength={300} className={inputClass} />
        <span className="mt-1 block text-xs text-zinc-500">
          Put a ticket number like [#5003] in the subject to send it as the customer&apos;s reply on that ticket.
        </span>
      </label>
      <label className={labelClass}>
        Message
        <textarea
          name="text"
          rows={5}
          required
          defaultValue={"Hi,\n\nMy ring hasn't synced since yesterday's update. I've restarted my phone and the app. Can you help?\n\nThanks,\nAanya"}
          className={inputClass}
        />
      </label>
      <Status error={state.error} success={state.success}>
        {state.ticketId && (
          <Link href={`/tickets/${state.ticketId}`} className="font-medium text-indigo-400 hover:text-indigo-300">
            Open it →
          </Link>
        )}
      </Status>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Receiving…" : "Receive this email"}
      </button>
    </form>
  );
}
