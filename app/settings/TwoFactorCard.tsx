"use client";

import { useState, useTransition } from "react";
import { confirmTwoFactorAction, disableTwoFactorAction, startTwoFactorAction, type TwoFactorSetup } from "./security-actions";

const button = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60";

export default function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [confirmOff, setConfirmOff] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<void>) => {
    setMessage({});
    startTransition(work);
  };

  if (enabled && !setup) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-emerald-300">On. Signing in needs your password and a code from your authenticator app.</p>
        {confirmOff ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-zinc-300">Turn it off? Your account will only be protected by your password.</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(async () => setMessage(await disableTwoFactorAction()))}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
            >
              {pending ? "Turning off…" : "Yes, turn off"}
            </button>
            <button type="button" onClick={() => setConfirmOff(false)} className="text-zinc-400 hover:text-zinc-200">
              Keep it on
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmOff(true)} className="text-rose-300 hover:text-rose-200">
            Turn off two-step sign-in
          </button>
        )}
        {message.error && <p role="alert" className="text-red-400">{message.error}</p>}
      </div>
    );
  }

  if (!setup?.factorId) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-zinc-400">
          Off. Turn it on so a stolen password isn&apos;t enough to get into your account. You&apos;ll need an
          authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        {(message.error || setup?.error) && <p role="alert" className="text-red-400">{message.error ?? setup?.error}</p>}
        {message.success && <p role="status" className="text-emerald-400">{message.success}</p>}
        {!message.success && (
          <button type="button" disabled={pending} onClick={() => run(async () => setSetup(await startTwoFactorAction()))} className={button}>
            {pending ? "Starting…" : "Turn on two-step sign-in"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <ol className="list-decimal space-y-1 pl-5 text-zinc-300">
        <li>Open your authenticator app and add an account by scanning this code.</li>
        <li>Enter the 6-digit code the app shows to finish.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-5">
        {/* The QR code is an SVG from Supabase, shown as-is */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qrCode} alt="QR code for your authenticator app" width={176} height={176} className="rounded-lg bg-white p-2" />
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-zinc-500">Can&apos;t scan it? Type this key into the app instead:</p>
          <p className="break-all font-mono text-xs text-zinc-200">{setup.secret}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-zinc-400">
          Code from the app
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            className="mt-1 block w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-mono tracking-[0.3em] text-zinc-100 outline-none focus:border-indigo-500"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const result = await confirmTwoFactorAction(setup.factorId!, code);
              setMessage(result);
              if (result.success) setSetup(null);
            })
          }
          className={button}
        >
          {pending ? "Checking…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setSetup(null)} className="pb-2 text-zinc-400 hover:text-zinc-200">
          Cancel
        </button>
      </div>
      {message.error && <p role="alert" className="text-red-400">{message.error}</p>}
    </div>
  );
}
