"use client";

import { useState, useTransition } from "react";
import { closeOrderAction } from "@/app/customers/actions";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  canCancel,
  canRefund,
  formatMoney,
  type Order,
} from "@/app/lib/orders";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ORDER_STATUS_STYLES[status]}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function OrderRow({ order, ticketId, canAct, highlight }: { order: Order; ticketId: string | null; canAct: boolean; highlight: boolean }) {
  const [confirming, setConfirming] = useState<"cancelled" | "refunded" | null>(null);
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [pending, startTransition] = useTransition();

  function act(to: "cancelled" | "refunded") {
    setResult({});
    startTransition(async () => {
      setResult(await closeOrderAction(order.id, to, ticketId));
      setConfirming(null);
    });
  }

  return (
    <li className={`rounded-lg border p-3 ${highlight ? "border-indigo-500/50 bg-indigo-500/5" : "border-zinc-800 bg-zinc-950/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm text-zinc-100">{order.orderNumber}</span>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-1.5 text-sm text-zinc-300">
        {order.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.name}${i.variant ? ` · ${i.variant}` : ""}`).join(", ")}
      </p>
      <p className="mt-1 text-xs text-zinc-500 tabular">
        {formatMoney(order.total, order.currency)} · placed {day(order.placedAt)}
        {order.deliveredAt ? ` · delivered ${day(order.deliveredAt)}` : order.shippedAt ? ` · shipped ${day(order.shippedAt)}` : ""}
      </p>
      {order.trackingNumber && (
        <p className="mt-1 text-xs text-zinc-500">
          {order.carrier ?? "Carrier"} tracking <span className="font-mono text-zinc-300">{order.trackingNumber}</span>
        </p>
      )}
      {order.closedBy && (
        <p className="mt-1 text-xs text-zinc-500">
          {ORDER_STATUS_LABELS[order.status]} by {order.closedBy}
        </p>
      )}

      {canAct && (canCancel(order) || canRefund(order)) && (
        <div className="mt-2.5">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-zinc-300">
                {confirming === "cancelled" ? "Cancel" : "Refund"} {formatMoney(order.total, order.currency)}?
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => act(confirming)}
                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {pending ? "Working…" : `Yes, ${confirming === "cancelled" ? "cancel" : "refund"}`}
              </button>
              <button type="button" onClick={() => setConfirming(null)} className="text-xs text-zinc-400 hover:text-zinc-200">
                Keep it
              </button>
            </div>
          ) : (
            <div className="flex gap-3 text-xs">
              {canCancel(order) && (
                <button type="button" onClick={() => setConfirming("cancelled")} className="font-medium text-rose-300 hover:text-rose-200">
                  Cancel order
                </button>
              )}
              {canRefund(order) && (
                <button type="button" onClick={() => setConfirming("refunded")} className="font-medium text-rose-300 hover:text-rose-200">
                  Refund
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {result.error && <p role="alert" className="mt-2 text-xs text-red-400">{result.error}</p>}
      {result.success && <p role="status" className="mt-2 text-xs text-emerald-400">{result.success}</p>}
    </li>
  );
}

// A customer's orders, newest first. On a ticket, orders it mentions are highlighted and cancel/refund is logged on it.
export default function OrdersPanel({
  orders,
  ticketId = null,
  mentioned = [],
  canAct,
  limit,
}: {
  orders: Order[];
  ticketId?: string | null;
  mentioned?: string[];
  canAct: boolean;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  // Orders the ticket mentions come first
  const sorted = [...orders].sort((a, b) => Number(mentioned.includes(b.orderNumber)) - Number(mentioned.includes(a.orderNumber)));
  const shown = limit && !showAll ? sorted.slice(0, limit) : sorted;

  if (!orders.length) return <p className="text-sm text-zinc-500">No orders on record.</p>;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {shown.map((order) => (
          <OrderRow key={order.id} order={order} ticketId={ticketId} canAct={canAct} highlight={mentioned.includes(order.orderNumber)} />
        ))}
      </ul>
      {limit && orders.length > limit && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
          {showAll ? "Show fewer" : `Show all ${orders.length} orders`}
        </button>
      )}
    </div>
  );
}
