"use client";

import { useActionState } from "react";
import { setNewPasswordAction } from "./actions";

const input =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function ResetForm() {
  const [state, action, pending] = useActionState(setNewPasswordAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <label className="block text-sm font-medium text-zinc-700">
        New password
        <input type="password" name="password" autoComplete="new-password" minLength={8} required className={input} />
      </label>
      <label className="block text-sm font-medium text-zinc-700">
        Type it again
        <input type="password" name="confirm" autoComplete="new-password" minLength={8} required className={input} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
