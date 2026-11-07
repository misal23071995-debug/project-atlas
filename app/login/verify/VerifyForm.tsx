"use client";

import { useActionState } from "react";
import { verifySecondStepAction } from "./actions";

export default function VerifyForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(verifySecondStepAction, {});
  return (
    <form action={action} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-zinc-700">
        Code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          autoFocus
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
