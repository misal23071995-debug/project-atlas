"use client";

import { useActionState, useState } from "react";
import { addOrderAction } from "../actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/app/lib/orders";

const input = "h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-indigo-500";

// For orders taken by phone or before a shop is connected
export default function AddOrderForm({ customerId, suggestedNumber }: { customerId: string; suggestedNumber: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addOrderAction.bind(null, customerId), {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-700 hover:text-indigo-700">
        + Add an order by hand
      </button>
    );
  }

  return (
    <form action={formAction} key={state.success} className="space-y-3 rounded-lg border border-zinc-200 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-zinc-600">
          Order number
          <input name="orderNumber" defaultValue={suggestedNumber} required className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-zinc-600">
          Status
          <select name="status" defaultValue="processing" className={`${input} mt-1`}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Item
          <input name="item" placeholder="Atlas Ring, size 9" required className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-zinc-600">
          Price (₹)
          <input name="price" type="number" min={0} step="1" required className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-zinc-600">
          Carrier (optional)
          <input name="carrier" className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-zinc-600">
          Tracking number (optional)
          <input name="trackingNumber" className={`${input} mt-1`} />
        </label>
      </div>
      {state.error && <p role="alert" className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p role="status" className="text-xs text-emerald-600">{state.success}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="h-8 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
          {pending ? "Adding…" : "Add order"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-600 hover:text-zinc-800">
          Close
        </button>
      </div>
    </form>
  );
}
