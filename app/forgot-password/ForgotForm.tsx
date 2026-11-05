"use client";

import { useActionState } from "react";
import { sendResetLinkAction } from "./actions";

export default function ForgotForm() {
  const [state, action, pending] = useActionState(sendResetLinkAction, {});

  if (state.sent) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-300">
        If that email has an Atlas account, a reset link is on its way. It works once and expires within an hour. Check
        your spam folder if it doesn&apos;t arrive in a few minutes.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <label className="block text-sm font-medium text-zinc-300">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Sending…" : "Email me a reset link"}
      </button>
    </form>
  );
}
